//
var g_password_store = []
const PASSWORD_DEPLETION_MIN = 3
const PASSWORD_BLOCKSIZE = 100
//
const fs = require('fs')
const crypto = require('crypto')
const clone = require('clone')
const WebSocket = require('ws')
const WebSocketServer = WebSocket.Server;
const http = require("http");
const passwordGenerator = require('generate-password');
const ShutdownManager = require('./lib/shutdown-manager')
const shutdown_server_helper_factory = require('http-shutdown')

const UserHandling = require('./contractual/user_processing')
const MimeHandling = require('./contractual/mime_processing')
const TranstionHandling = require('./contractual/transition_processing')



// https://github.com/fastify/fastify

let g_expected_modules = [
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
//
const conf_obj = load_parameters()                  // configuration parameters to select modules, etc.
const g_custom_transitions = require(conf_obj.mod_path.custom_transitions)
// SPECIAL NAMED TRANSITIONS (PATHS)
g_custom_transitions.initialize(conf_obj)
// CONFIGURE
const g_db = require(conf_obj.mod_path.db)                   // The database interface. Sets up session store, static store, and other DB pathways
const g_middleware = require(conf_obj.mod_path.middleware)   // This is middleware for Express applications
const g_authorizer = require(conf_obj.mod_path.authorizer)   // Put authorization mechanics here.
const g_statics = require(conf_obj.mod_path.static_assets)   // Special handling for fetching static assets.
const g_dynamics = require(conf_obj.mod_path.dynamic_assets) // Program spends some time creating the asset.
const g_validator = require(conf_obj.mod_path.validator)     // Custom access to field specification from configuration and the application through DB or inline code
const g_business = require(conf_obj.mod_path.business)       // backend tasks that don't return values, but may send them out to other services.. (some procesing involved)
const g_transition_engine = require(conf_obj.mod_path.transition_engine)
//
var g_app = require(conf_obj.mod_path.expression)(conf_obj,g_db); // exports a function
var g_session_manager = null

var g_max_cache_time = 3600000*2  // once every two hours
//

var g_user_handler = false
var g_mime_handler = false
var g_transition_processing = false
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

// INITIALIZE
async function initialize_all() {
    g_db.initialize(conf_obj)
    g_business.initialize(conf_obj,g_db)
    g_transition_engine.initialize(conf_obj,g_db)
    //
    g_session_manager = g_authorizer.sessions(g_app,g_db,g_business,g_transition_engine)   // setup session management, session, cookies, tokens, etc. Use database and Express api.
                                                                // sessions inializes the custom session manager determined in the application authorizer.
    g_middleware.setup(g_app,g_db,g_session_manager)            // use a module to cusomize the use of Express middleware.
    g_validator.initialize(conf_obj,g_db,g_session_manager)     // The validator may refer to stored items and look at other context dependent information
    g_statics.initialize(g_db,conf_obj)                         // Static assets may be taken out of DB storage or from disk, etc.
    await g_dynamics.initialize(g_db,conf_obj)                        // Dynamichk assets may be taken out of DB storage or from disk, etc.
    g_transition_engine.install(g_statics,g_dynamics,g_session_manager)

    //  --- contractual logic ---
    g_user_handler = new UserHandling(g_session_manager,g_validator,g_statics,g_dynamics,g_max_cache_time)
    g_mime_handler = new MimeHandling(g_session_manager,g_validator,g_statics,g_dynamics,g_max_cache_time)
    g_transition_processing = new TranstionHandling(g_session_manager,g_validator,g_dynamics,g_max_cache_time)
    //
}

initialize_all()

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
g_app.get('/', (req, res) => {
    try {
        let html = g_statics.fetch('index.html');
        console.log(html)
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);    
    } catch (e) {
        res.end('system check')
    }
});

// STATIC FETCH
g_app.get('/static/:asset', async (req, res) => {
    let asset = req.params['asset']
    let body = {}
    let [code,header,data] = await g_mime_handler.static_asset_handler(asset,body,req.headers) 
    if ( data !== false ) {
        res.writeHead(code,header);
        res.end(data);    
    } else {
        res.status(code).send(JSON.stringify(header))
    }
});


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

// STATIC KEYED MIME_TYPES  -- no form validation, but GUARD asset within a session
let g_secondary_mime_actions = {}
g_app.post('/guarded/static/:asset', async (req, res) => {
    let asset = req.params['asset']
    let body = req.body
    let [code,header,data] = await g_mime_handler.guarded_static_asset_handler(asset,body,req.headers) 
    if ( typeof data === 'boolean' ) {
        res.status(code).send(JSON.stringify(header))
    } else {
        res.writeHead(code,header);
        res.end(data);    
    }
});

g_app.post('/guarded/dynamic/:asset', async (req, res) => {
    let asset = req.params['asset']
    let body = req.body
    let [code,header,data] = await g_mime_handler.guarded_dynamic_asset_handler(asset,body,req.headers)
    if ( typeof data === 'boolean' ) {
        res.status(code).send(JSON.stringify(header))
    } else {
        res.writeHead(code,header);
        res.end(data);    
    }
});

// KEYED MIME_TYPES  - TRANSITION ACCEPTED  -- the body should send back the token it got with the asset.
g_app.post('/secondary/guarded', async (req,res) => {
    let body = req.body
    let [code,header,data] = await g_mime_handler.guarded_secondary_asset_handler(body) 
    if ( typeof data === 'boolean' ) {
        res.status(code).send(JSON.stringify(header))
    } else {
        res.writeHead(code,header);
        res.end(data);    
    }
})


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

// TRANSITIONS - pure state transition dynamics for sessions

g_app.post('/transition/:transition', async (req, res) => {           // the transition is a name or key
    let body = req.body
    let transition = req.params.transition
    let [code,data] = await g_transition_processing.transition_handler(transition,body,req.headers)
    res.status(code).send(JSON.stringify(data))
});

// TRANSITIONS  - TRANSITION ACCEPTED  -- the body should send back the token it got with the asset.
g_app.post('/secondary/transition',async (req, res) => {
    let body = req.body
    //
    let [code,data] = await g_transition_processing.secondary_transition_handler(body) 
    res.status(code).send(JSON.stringify(data))
})


var setup_foreign_auth = () => {}
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
if ( conf_obj.login_app ) {   // LOGIN APPS OPTION (START)
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------



// USER MANAGEMENT - handle authorization and user presence.
for ( let path of ['/users/login','/users/logout','/users/register','/users/forgot'] ) {
    g_app.post(path, async (req,res) => {
        //
        let body = req.body
        let user_op = body['action']
        //
        let [code,result] = await g_user_handler.user_sessions_process(user_op,body)
        if ( result.OK === 'true' ) {
            g_session_manager.handle_cookies(result,res,transitionObj)
        }
        return(res.status(code).send(JSON.stringify( result )));
        //
    })
}




 
// USER MANAGEMENT - finalize the user action.
g_app.post('/secondary/users/:action', async (req, res) => {
    let body = req.body
    let action = req.params['action']
    let [code,result] = await g_user_handler.secondary_processing(action,body)
    if ( result.OK === 'true' ) {
        g_session_manager.handle_cookies(result,res,transitionObj)
    }
    return(res.status(code).send(JSON.stringify( result )));
})


g_app.post('/foreign_login/:token', async (req, foreign_res) => {  // or use the websockets publication of state....
    let body = req.body
    let token = req.params.token
    let [code,report,response] = await g_user_handler.foreign_authorizer(body,token)
    foreign_res.status(code).end(report)
    g_user_handler.send_ws_outofband(token,response)
})


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
}       // LOGIN APPS OPTION (END)
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

// APPLICATION STARTUP
//
g_db.last_step_initalization()
var g_exp_server = g_app.listen(conf_obj.port,() => {
    console.log(`listening on ${conf_obj.port}`)
});

//var g_shutdown_server_helper = shutdown_server_helper_factory(g_exp_server)
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
if ( conf_obj.ws_port ) {   // WEB SCOCKETS OPTION (START)
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

let server = http.createServer(g_app);
server.listen(conf_obj.ws_port);
var g_auth_wss = new WebSocketServer({server: server});

console.log(`web socket listening: ${conf_obj.ws_port}`)

var g_going_sitewide_ws_session = {}

g_auth_wss.on("connection", (ws,req) => {
    //
    if ( req.path === "foreign_auth" ) {

        if ( setup_foreign_auth ) setup_foreign_auth(ws)

    } else if (  req.path === "site_wide"  ) {

        function send_to_ws(ws,data) {
            if ( g_auth_wss && token_key ) {
                if ( ws ) {
                    ws.send(JSON.stringify(data));
                }
            }
        }

        ws.on("message",  async (data, flags) => {
            
            let body = JSON.parse(data.toString());
            let ping_id = body.ping_id
            if ( ping_id ) {
                if ( g_transition_engine ) {
                    g_transition_engine.ponged(ws)
                }
            } else {
                let token = body.token
                if ( token ) {
                    if ( body.action === 'setup' ) {
                        let ws_data = g_going_sitewide_ws_session[token]
                        if ( ws_data === undefined ) {
                            g_going_sitewide_ws_session[token] = [ ws ]
                        } else {
                            let ws_list = g_going_sitewide_ws_session[token]
                            if ( ws_list.indexOf(ws) < 0 ) {
                                ws_list.push(ws)
                            }
                        }    
                    } else if ( body.action === "logout" ) {
                        let ws_list = g_going_sitewide_ws_session[token]
                        let command = {
                            'action' : 'logout',
                            'token' : token
                        }
                        ws_list.forEach(ws => {
                            send_to_ws(ws,command)
                        })
                    }
                }    
            }
        });

        ws.on("close", () => {
            let token = null
            for ( let tk in g_going_ws_session ) {
                let ws_dex = g_going_ws_session[tk].indexOf(ws)
                if ( ws_dex >= 0 ) {
                    token = tk
                    g_going_ws_session[token].splice(ws_dex,1)
                    break
                }
            }
            if ( token && (g_going_ws_session[token].length == 0) ) {
                delete g_going_ws_session[token]
            }
        });
    }
});

// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
}       // WEB SCOCKETS OPTION (END)
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

var g_proc_ws_token = ''
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
if ( conf_obj.ws_client_port && !(g_debug) ) {   // SUPPORT SERVICE WEB SCOCKETS OPTION (START)
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
    var g_ws_client_attempt_timeout = null
    function ws_connection_attempt() {
        try {
            // setup a webSocket connection to get finalization data on logging in. -- 
            let socket_host =  conf_obj.ws_client_server
            //
            g_sitewide_socket = new WebSocket(`ws://${socket_host}/auth_ws/site_wide`);
            g_sitewide_socket.on('error',(e) => {
                g_sitewide_socket = null
                console.log(e.message)
                if (  e.code == 'ECONNREFUSED'|| e.message.indexOf('502') > 0 ) {
                    console.log("try again in 1 seconds")
                    g_ws_client_attempt_timeout = setTimeout(ws_connection_attempt,1000)
                } else {
                    console.dir(e)
                }
            })
            g_sitewide_socket.on('open', () => {
                //
                console.log("web sockets connected")
                if ( g_ws_client_attempt_timeout != g_ws_client_attempt_timeout ) clearTimeout(g_ws_client_attempt_timeout)
                //
                let msg = {
                    'token' : g_proc_ws_token,
                    'action' : 'setup'
                }
                g_sitewide_socket.send(JSON.stringify(msg))
                //
            })
            g_sitewide_socket.onmessage = async (event) => {	// handle the finalization through the websocket
                                    try {
                                        let handler = JSON.parse(event.data)
                                        if ( handler.data && (handler.data.type === 'ping') ) {
                                            if ( g_sitewide_socket ) {
                                                let ponger = {
                                                    "ping_id" : msg.data.ping_id,
                                                    "time" : Date.now()
                                                }
                                                g_sitewide_socket.send(JSON.stringify(ponger))
                                            }
                                        } else {
                                            if ( handler.token === token ) {
                                                if ( handler.action === "logout" ) {
                                                    await g_session_manager.process_user('logout',handler,null,null)
                                                } else {
                                                    eval(handler.action)
                                                }
                                            }
                                        }
                                    } catch (e) {
                                    }
                                }
        } catch(e) {
            console.log(e.message)
            console.dir(e)
            process.exit(1)
        }
    }

    ws_connection_attempt()

// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
}       // SUPPORT SERVICE WEB SCOCKETS OPTION (END)
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
if ( conf_obj.wss_app_port ) {   // WEB APP SCOCKETS OPTION (START)
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

let app_server = http.createServer(g_app);
app_server.listen(conf_obj.wss_app_port);
var g_app_wss = new WebSocketServer({server: app_server});

console.log(`web app socket listening: ${conf_obj.wss_app_port}`)

g_app_wss.on("connection", (ws,req) => {
    //
    if (  req.url.indexOf("/transitional") > 0  ) {

        if ( g_transition_engine ) {
            g_transition_engine.set_wss_sender((ws,data) => {
                if ( g_app_wss ) {
                    if ( ws ) {
                        ws.send(JSON.stringify(data));
                    }
                }
            })
            g_transition_engine.add_ws_session(ws)
        }

        ws.on("message",  async (data, flags) => {
            //
            let body = JSON.parse(data.toString());
            //
            let server_id = body.message ? body.message.server_id : false
            if ( server_id ) {
                 // transitional
                let transition = body.transition
                let message = body.message
                let is_feasible = await g_session_manager.feasible(transition,message,null)
                if ( is_feasible ) {
                    let finalization_state = await g_session_manager.finalize_transition(transition,message,{},null)      // FINALIZE (not a final state)
                    if ( finalization_state ) {
                        ws.send(JSON.stringify(finalization_state));
                    }
                }
            } else {
                let ping_id = body.ping_id
                if ( ping_id ) {
                    if ( g_transition_engine ) {
                        g_transition_engine.ponged(ws)
                    }
                }
            }
        });

        ws.on("close", () => {
            g_transition_engine.close_wss_session(ws)
        });
    }
});


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
}       // WEB APP SCOCKETS OPTION (END)
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

var g_hex_re = /^[0-9a-fA-F]+$/;
function load_parameters() {
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

    global.global_hasher = (str) => {
        if ( str ) {
            const hash = crypto.createHash('sha256');
            hash.update(str);
            return(hash.digest('hex'))
        }
        return('')
    }

    global.global_shutdown_manager = new ShutdownManager()

    let config = "./user-service.conf"
    if ( process.argv[2] !== undefined ) {
        config = process.argv[2];
    }

    if (  process.argv[3] !== undefined ) {
        if ( process.argv[3] === 'debug' ) {
            g_debug = true
        }
    }

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


process.on('SIGINT', async () => {
    try {
        await g_db.disconnect()
        global_shutdown_manager.shutdown_all()
        process.exit(0)
        /*
        g_shutdown_server_helper.shutdown(async (err) => {
            process.exit(0)
        })   
        */
    } catch (e) {
        console.log(e)
        process.exit(0)
    }
});
