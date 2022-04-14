//
const fs = require('fs')
const crypto = require('crypto')
const clone = require('clone')
const WebSocket = require('ws')
const WebSocketServer = WebSocket.Server;
const http = require("http");
const passwordGenerator = require('generate-password');
const ShutdownManager = require('./lib/shutdown-manager')
//const shutdown_server_helper_factory = require('http-shutdown')

const UserHandling = require('./contractual/user_processing')
const MimeHandling = require('./contractual/mime_processing')
const TranstionHandling = require('./contractual/transition_processing');
const { EventEmitter } = require('events');

// https://github.com/fastify/fastify

let g_password_store = []
const PASSWORD_DEPLETION_MIN = 3
const PASSWORD_BLOCKSIZE = 100

//
const g_expected_modules = [
                            "custom_transitions",
                            "db",
                            "middleware",
                            "authorizer",
                            "validator",
                            "static_assets",
                            "dynamic_assets",
                            "expression",
                            "business",
                            "transition_engine"
                        ]
//
let g_proc_ws_token = ''
const g_hex_re = /^[0-9a-fA-F]+$/;
//

class CopiousTransitions extends EventEmitter {
    //
    constructor(config,debug) {
        this.debug = debug
        const conf_obj = load_parameters(config)                  // configuration parameters to select modules, etc.
        this.conf_obj = conf_obj
        this.port = conf_obj.port
        //
        this.custom_transitions = require(conf_obj.mod_path.custom_transitions)
        // SPECIAL NAMED TRANSITIONS (PATHS)
        this.custom_transitions.initialize(conf_obj)
        // CONFIGURE
        this.db = require(conf_obj.mod_path.db)                   // The database interface. Sets up session store, static store, and other DB pathways
        this.middleware = require(conf_obj.mod_path.middleware)   // This is middleware for Express applications
        this.authorizer = require(conf_obj.mod_path.authorizer)   // Put authorization mechanics here.
        this.statics = require(conf_obj.mod_path.static_assets)   // Special handling for fetching static assets.
        this.dynamics = require(conf_obj.mod_path.dynamic_assets) // Program spends some time creating the asset.
        this.validator = require(conf_obj.mod_path.validator)     // Custom access to field specification from configuration and the application through DB or inline code
        this.business = require(conf_obj.mod_path.business)       // backend tasks that don't return values, but may send them out to other services.. (some procesing involved)
        this.transition_engine = require(conf_obj.mod_path.transition_engine)
        //
        this.app = require(conf_obj.mod_path.expression)(conf_obj,this.db); // exports a function
        this.session_manager = null
        //
        this.max_cache_time = 3600000*2  // once every two hours
        //
        this.user_handler = false
        this.mime_handler = false
        this.transition_processing = false
        //
        (async () => {
            await this.initialize_all(conf_obj)
            this.setup_paths(conf_obj)
            this.emit('ready')
        })()
        
    }

    // INITIALIZE
    async initialize_all(conf_obj) {
        //
        this.db.initialize(conf_obj)
        this.business.initialize(conf_obj,this.db)
        this.transition_engine.initialize(conf_obj,this.db)
        //
        this.session_manager = this.authorizer.sessions(this.app,this.db,this.business,this.transition_engine)   // setup session management, session, cookies, tokens, etc. Use database and Express api.
                                                                    // sessions inializes the custom session manager determined in the application authorizer.
        this.middleware.setup(this.app,this.db,this.session_manager)            // use a module to cusomize the use of Express middleware.
        this.validator.initialize(conf_obj,this.db,this.session_manager)     // The validator may refer to stored items and look at other context dependent information
        this.statics.initialize(this.db,conf_obj)                         // Static assets may be taken out of DB storage or from disk, etc.
        await this.dynamics.initialize(this.db,conf_obj)                        // Dynamichk assets may be taken out of DB storage or from disk, etc.
        this.transition_engine.install(this.statics,this.dynamics,this.session_manager)

        //  --- contractual logic ---
        let use_foreign = conf_obj.foreign_auth.allowed
        this.user_handler = new UserHandling(this.session_manager,this.validator,this.statics,this.dynamics,this.transition_engine,use_foreign,this.max_cache_time)
        this.mime_handler = new MimeHandling(this.session_manager,this.validator,this.statics,this.dynamics,this.max_cache_time)
        this.transition_processing = new TranstionHandling(this.session_manager,this.validator,this.dynamics,this.max_cache_time)
        this.transition_engine.set_contractual_filters(this.transition_processing,this.user_handler)
        //
    }


    setup_paths(conf_obj) {
        /*
        /static/:asset            -- previously static_mime.  This just returns a static (not computed) piece of information. The app should be able to set the mime type.
        /guarded/static/:asset    -- previously keyed_mime.   Same as above, but checks the session for access.
        /guarded/dynamic/:asset   -- does the same as static but calls on functions that generate assets -- could be a function service.
        /guarded/secondary        -- a handshake that may be required of some assets before delivery of the asset.
        /transition/:transition   -- a kind of transition of the session -- this may return a dynamic asset or it might just process a form -- a change of state expected
        /transition/secondary     -- a handshake that may be required of some assets before delivery of the asset and always finalization of transition
        '/users/login','/users/logout','/users/register','/users/forgot' -- the start, stop sessions, manage passwords.
        /users/secondary/:action  -- the handler for user session management that may require a handshake or finalization.
        */

        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

        // ROOT ... unauthorized entry point  -- this is likely to be done by Nginx and will not be needed here.
        this.app.get('/', (req, res) => {
            try {
                let html = this.statics.fetch('index.html');
                console.log(html)
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);    
            } catch (e) {
                res.end('system check')
            }
        });

        // STATIC FETCH
        this.app.get('/static/:asset', async (req, res) => {
            let asset = req.params['asset']
            let body = {}
            let [code,header,data] = await this.mime_handler.static_asset_handler(asset,body,req.headers) 
            if ( data !== false ) {
                res.writeHead(code,header);
                res.end(data);    
            } else {
                res.status(code).send(JSON.stringify(header))
            }
        });


        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

        // STATIC KEYED MIME_TYPES  -- no form validation, but GUARD asset within a session
        this.app.post('/guarded/static/:asset', async (req, res) => {
            let asset = req.params['asset']
            let body = req.body
            let [code,header,data] = await this.mime_handler.guarded_static_asset_handler(asset,body,req.headers) 
            if ( typeof data === 'boolean' ) {
                res.status(code).send(JSON.stringify(header))
            } else {
                res.writeHead(code,header);
                res.end(data);    
            }
        });

        this.app.post('/guarded/dynamic/:asset', async (req, res) => {
            let asset = req.params['asset']
            let body = req.body
            let [code,header,data] = await this.mime_handler.guarded_dynamic_asset_handler(asset,body,req.headers)
            if ( typeof data === 'boolean' ) {
                res.status(code).send(JSON.stringify(header))
            } else {
                res.writeHead(code,header);
                res.end(data);    
            }
        });

        // KEYED MIME_TYPES  - TRANSITION ACCEPTED  -- the body should send back the token it got with the asset.
        this.app.post('/secondary/guarded', async (req,res) => {
            let body = req.body
            let [code,header,data] = await this.mime_handler.guarded_secondary_asset_handler(body) 
            if ( typeof data === 'boolean' ) {
                res.status(code).send(JSON.stringify(header))
            } else {
                res.writeHead(code,header);
                res.end(data);    
            }
        })


        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

        // TRANSITIONS - pure state transition dynamics for sessions

        this.app.post('/transition/:transition', async (req, res) => {           // the transition is a name or key
            let body = req.body
            let transition = req.params.transition
            let [code,data] = await this.transition_processing.transition_handler(transition,body,req.headers)
            res.status(code).send(JSON.stringify(data))
        });

        // TRANSITIONS  - TRANSITION ACCEPTED  -- the body should send back the token it got with the asset.
        this.app.post('/secondary/transition',async (req, res) => {
            let body = req.body
            //
            let [code,data] = await this.transition_processing.secondary_transition_handler(body) 
            res.status(code).send(JSON.stringify(data))
        })


        let setup_foreign_auth = conf_obj.foreign_auth.allowed
        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
        if ( conf_obj.login_app  && Array.isArray(conf_obj.login_app) ) {   // LOGIN APPS OPTION (START)
        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

            if ( setup_foreign_auth ) {
                setup_foreign_auth = (ws) => { this.user_handler.foreign_auth_initializer(ws) }
            }

            //
            // USER MANAGEMENT - handle authorization and user presence.
            for ( let path of conf_obj.login_app ) {
                //
                this.app.post(path, async (req,res) => {
                    //
                    let body = req.body
                    let user_op = body['action']
                    //
                    let [code,result] = await this.user_handler.user_sessions_processing(user_op,body)
                    if ( result.OK === 'true' ) {
                        let transitionObj = result.data
                        this.session_manager.handle_cookies(result,res,transitionObj)
                    }
                    return(res.status(code).send(JSON.stringify( result )));
                    //
                })
            }


            // USER MANAGEMENT - finalize the user action.
            this.app.post('/secondary/users/:action', async (req, res) => {
                let body = req.body
                let action = req.params['action']
                let [code,result] = await this.user_handler.secondary_processing(action,body)
                if ( result.OK === 'true' ) {
                    let transitionObj = result.data
                    this.session_manager.handle_cookies(result,res,transitionObj)
                }
                return(res.status(code).send(JSON.stringify( result )));
            })


            this.app.post('/foreign_login/:token', async (req, foreign_res) => {  // or use the websockets publication of state....
                let body = req.body
                let token = req.params.token
                let [code,report,response] = await this.user_handler.foreign_authorizer(body,token)
                foreign_res.status(code).end(report)
                this.user_handler.send_ws_outofband(token,response)
            })


        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
        }       // LOGIN APPS OPTION (END)
        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

    }


    setup_ws(conf_obj) {
        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
        if ( conf_obj.ws_port ) {   // WEB SCOCKETS OPTION (START)    Web Socket Server
            // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
    
            let server = http.createServer(this.app);
            server.listen(conf_obj.ws_port);
        
            this.auth_wss = new WebSocketServer({server: server});
            
            this.auth_wss.on("connection", (ws,req) => {
            
                if ( !this.auth_wss ) {
                    console.log("ws connection attempt after shutdown")
                    return
                }
                //
                //
                let path_on_connect = req.path      // MESSAGE PATHWAYS
                //
                switch ( path_on_connect ) {
                    //
                    case "foreign_auth" : {
                        if ( setup_foreign_auth ) setup_foreign_auth(ws)
                        break
                    }
                    //
                    case "site_wide" : {
                        ws.on("message",this.transition_engine.ws_message_handler)  // data parameter implicit
                        ws.on("close",() => { this.transition_engine.ws_shutdown(ws) })
                        break;
                    }
                }
                //
            });
            
            // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
            }       // WEB SCOCKETS OPTION (END)
            // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

            // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
            if ( conf_obj.ws_client_port && !(g_debug) ) {   // SUPPORT SERVICE WEB SCOCKETS OPTION (START)  Web Socket Client
            // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
            
            let socket_host =  conf_obj.ws_client_server
            let sitewide_socket = new WebSocket(`ws://${socket_host}/auth_ws/site_wide`);
            this.transition_engine.ws_connection_attempt(g_proc_ws_token,sitewide_socket)
        
        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
        }       // SUPPORT SERVICE WEB SCOCKETS OPTION (END)
        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
    }


    setup_app_ws(conf_obj) {
        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
        if ( conf_obj.wss_app_port ) {   // WEB APP SCOCKETS OPTION (START)
            // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
            let app_server = http.createServer(this.app);
            app_server.listen(conf_obj.wss_app_port);
            this.app_wss = new WebSocketServer({server: app_server});
            
            this.app_wss.on("connection", (ws,req) => {
                if ( req.url.indexOf("/transitional") > 0  ) {
                    this.transition_engine.setup_app_ws(ws,this.app_wss)
                }
            });
            
        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
        }       // WEB APP SCOCKETS OPTION (END)
        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
    }



    

    // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
    //       // RUN AND STOP
    // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

    run() {
        // APPLICATION STARTUP
        this.db.last_step_initalization()
        this.app.listen(this.port,() => {
            console.log(`listening on ${this.port}`)
        });
        //
        this.setup_ws(this.conf_obj)
        this.setup_app_ws(this.conf_obj)
        //
    }


    setup_stopping() {
        process.on('SIGINT', async () => {
            try {
                await this.db.disconnect()
                global_shutdown_manager.shutdown_all()
                process.exit(0)
                /*
                this.shutdown_server_helper.shutdown(async (err) => {
                    process.exit(0)
                })   
                */
            } catch (e) {
                console.log(e)
                process.exit(0)
            }
        });
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
}

// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------


function generate_password_block() {
    //
    var passwords = passwordGenerator.generateMultiple(PASSWORD_BLOCKSIZE, {
        length: 10,
        uppercase: false
    });
    //
    g_password_store = g_password_store.concat(passwords)
}

function load_parameters(config) {
    //
    global.g_debug = false
    //
    global.clonify = (obj) => {
        return(clone(obj))
        /*
        if ( typeof obj == "object" ) {
            return(JSON.parse(JSON.stringify(obj)))
        }
        return(obj)
        */
    }

    global.isHex = (str) => {
        let check = g_hex_re.test(str)
        g_hex_re.lastIndex = 0; // be sure to reset the index after using .text()
        return(check)
    }

    global.do_hash = (text) => {
        const hash = crypto.createHash('sha256');
        hash.update(text);
        let ehash = hash.digest('hex');
        return(ehash)
    }

    generate_password_block()

    global.generate_password = () => {
        let password = g_password_store.shift()
        if ( g_password_store.length < PASSWORD_DEPLETION_MIN ) {
            setTimeout(generate_password_block,100)
        }
        return(password)
    }

    global.global_hasher = (str,specials) => {               // global_hasher(user_str,ipfs) // can ask to store the record on chain...
        if ( str ) {
            const hash = crypto.createHash('sha256');
            hash.update(str);
            return(hash.digest('hex'))
        }
        return('')
    }

    global.global_shutdown_manager = new ShutdownManager()


    g_proc_ws_token = do_hash('' + config + '+=+' + Date.now())

    try {
        let data = fs.readFileSync(config,'ascii').toString()
        //
        //console.log(data[p] + " --- " + data.substr(p,40))
        //
        let confJSON = JSON.parse(data)
        let module_path = confJSON.module_path
        global.global_module_path = module_path
        confJSON.mod_path = {}
        g_expected_modules.forEach(mname => {
            let modName = confJSON.modules[mname]
            if ( (typeof modName === 'string') || ( modName === undefined )  ) {
                if ( modName ) {
                    confJSON.mod_path[mname] = __dirname + `/${module_path}/${modName}`
                } else {
                    confJSON.mod_path[mname] = __dirname + `/defaults/lib/default_${mname}`
                }
            } else if ( typeof modName === 'object' ) {  // allow for modules from other locations
                modName = modName.module
                let alternate_mod_path = modName.mod_path   // perhaps filter this in the future to attain some standard in locations..
                confJSON.mod_path[mname] = __dirname + `/${alternate_mod_path}/${modName}`
            } else {
                console.log(mname,modName)
                throw new Error("ill formed module name in config file")
            }
        })
        return(confJSON)
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}


module.exports = CopiousTransitions
