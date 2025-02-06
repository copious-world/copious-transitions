/**
 * @namespace CopiousTransitions
 */
const fs = require('fs')
const crypto = require('crypto')
const clone = require('clone')
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
                            "transition_engine",
                            "web_sockets",
                            "endpoint_server"
                        ]
//

const g_hex_re = /^[0-9a-fA-F]+$/;
//


// global_appwide_token
global.global_appwide_token = () => {      // was uuid -- may change
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
        });
}


/**
 * 
 * The class provided in this module provides the main method for the entry point to an application running 
 * a CopiousTransitions web server.
 * 
 * Here is a typical application. 
 * 
 * ```
const CopiousTransitions = require('copious-transitions')  // include this module

let [config,debug] = [false,false]      // define the variables

config = "./user-service-myapp.conf"    // set the configuration file name
if ( process.argv[2] !== undefined ) {
    config = process.argv[2];
}

if (  process.argv[3] !== undefined ) {  // maybe use debugging
    if ( process.argv[3] === 'debug' ) {
        debug = true
    }
}

let transition_app = new CopiousTransitions(config,debug,__dirname)  // Initialize everything according to the configuration.
// in this application the local directory of the calling module is the place to look for mod path modules to be loaded.

transition_app.on('ready',() => {       // when the configuration is done the application is ready to run
    transition_app.run()                // run the application
})

```
 * 
 * The constructor loads all the modules that are configured for execution.
 * Take note that the module are not specified at the top of file where this class is defined.
 * The modules that this process will use are required to be specified in the configuration file.
 * 
 * The constuctor first calls `load_parameters` which can reset the module offsets as needed. 
 * In some cases, a module might not be listed in the configuration, for instance. 
 * 
 * The `load_parameters` call also defines a set of global variables and methods that can be used throughout the process
 * as needed. A restriction of the basic module architecture is that these globals be defined here and nowhere else. 
 * (While there is no way to regulate the management of globals in an application, it is recommended to keep any global definitions
 * in one place.)
 * 
 * After the `load_parameters` call is performed, the required modules are loaded. Each module is responsible for returning a 
 * constucted object based on the classes defined with it.
 * 
 * In the module stack, most of the salient variables that must be configured are set in the intialization methods. 
 * The same is true here, and the constructor defers the all the initializations to the initialization method.
 * The main initialization method is asynchronous, and so this constructor parsels its call out to a thunk.
 * 
 * The only modules that are loaded by `requires` at the top of this file are the `contractual` modules. 
 * The `contractual` modules are supposed to be universal enough so as to not require overrides. In some cases, 
 * an application might choose to replace the. Such applications can override the class provided here. The method `initlialize_contractuals`
 * is set aside for the purpose of overriding these methods. However, it is recommended that the existing methods be kept in tact, 
 * as they define the basic structure for handling requests in applications derived from CopiousTransitions.
 * 
 * @memberof CopiousTransitions
 */

class CopiousTransitions extends EventEmitter {
    //
    constructor(config,debug,caller_dir) {
        super()
        this.debug = debug
        const conf_obj = load_parameters(config,caller_dir)                  // configuration parameters to select modules, etc.
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
        this.web_sockets = require(conf_obj.mod_path.web_sockets) // web sockets - serveral types of application supported -- use app chosen ws interface
        this.endpoint_server = require(conf_obj.mod_path.endpoint_server) // certain applications will handle transition from the backend
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
        this.caller_dir = caller_dir
        //
        let b = (async () => {
            await this.initialize_all(conf_obj)
            this.setup_paths(conf_obj)
            this.emit('ready')
        })

        b()
    }


    // INITIALIZE
    /**
     * 
     * @param {object} conf_obj 
     */
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
        this.initlialize_contractuals()
        // websocket access to contractual logic
        this.web_sockets.initialize(conf_obj,this.app)
        this.web_sockets.set_contractual_filters(this.transition_processing,this.user_handler,this.mime_handler)
        //
        this.endpoint_server.initialize(conf_obj,this.db)
        this.endpoint_server.set_contractual_filters(this.transition_processing,this.user_handler,this.mime_handler)
        this.endpoint_server.set_ws(this.web_sockets)
        //
        // transition engine access to web sockets and contractual logic
        this.transition_engine.set_ws(this.web_sockets)
        this.transition_engine.set_contractual_filters(this.transition_processing,this.user_handler,this.mime_handler)
        //
    }


    /**
     * Construct the contractual handlers. Simply new object instances. 
     * Pass in the previously allocated handlers. 
     */
    initlialize_contractuals() {
        let use_foreign = false // conf_obj.foreign_auth.allowed (deprecated)
        this.user_handler = new UserHandling(this.session_manager,this.validator,this.statics,this.dynamics,this.transition_engine,use_foreign,this.max_cache_time)
        this.mime_handler = new MimeHandling(this.session_manager,this.validator,this.statics,this.dynamics,this.max_cache_time)
        this.transition_processing = new TranstionHandling(this.session_manager,this.validator,this.dynamics,this.max_cache_time)    
    }


    /**
     * Set up the web api paths which will be used by the router to find the handler methods.
     * The paths specified in this method are a short list of paths describing the general types of transactions 
     * that are needed to carry out actions for fetching something, creating something to be returned as a mime type asset, 
     * or for performing a state transition. Some paths are of the type that are *guarded*. Guarded paths require user identification
     * via session identification and token matching, especially if there is a secondary action.
     * 
     * Here is a list of the paths that this module defines:
     * 
     * * /static/:asset            -- previously static_mime.  This just returns a static (not computed) piece of information. The app should be able to set the mime type.
     * * /guarded/static/:asset    -- previously keyed_mime.   Same as above, but checks the session for access.
     * * /guarded/dynamic/:asset   -- does the same as static but calls on functions that generate assets -- could be a function service.
     * * /guarded/secondary        -- a handshake that may be required of some assets before delivery of the asset.
     * * /transition/:transition   -- a kind of transition of the session -- this may return a dynamic asset or it might just process a form -- a change of state expected
     * * /transition/secondary     -- a handshake that may be required of some assets before delivery of the asset and always finalization of transition
     * * '/users/login','/users/logout','/users/register','/users/forgot' -- the start, stop sessions, manage passwords.
     * * /users/secondary/:action  -- the handler for user session management that may require a handshake or finalization.
     * 
     * Each of these paths hands off processing to a type of contractual class. Each contractual class defines the checks on permission
     * and availability that is needed to retrieve an asset or perform an action. (Note: contractual class in this case do not have to
     * do with blockchain contract processing [yet such versions of these classes can be imagined]) What is meant by contractual here
     * is that the client (browser... usually) and the server will provide authorization, session identity, and token handshakes 
     * in a particular, well-defined way.
     * 
     * Note that that there are three types of contractual classes:
     * 
     * 1. user processing - this type of processing has to do with the user session being established or terminated and user existence.
     * 2. mime processing - This processing has to do with items being returned to the client, e.g. images, text, HTML, JSON, etc.
     * 3. transition processing - This proessing has to do with driving a state machine in some way.
     * 
     * In the case of state machine processing, most of the application are just taking in data, sending it somewhere, and updating a database
     * about the state of the data and/or the user. In some applications, an actual state machine (for the user) might be implemented and the finalization 
     * of the state will result in reseting the state of the machine for a particular user. 
     * 
     * How the methods map to the contractual methods:
     * 
     * * /static/:asset            -- `mime_handler.static_asset_handler`
     * * /guarded/static/:asset    -- `mime_handler.guarded_static_asset_handler`
     * * /guarded/dynamic/:asset   -- `mime_handler.guarded_dynamic_asset_handler`
     * * /guarded/secondary        -- `mime_handler.guarded_secondary_asset_handler`
     * * /transition/:transition   -- `transition_processing.transition_handler`
     * * /transition/secondary     -- `transition_processing.secondary_transition_handler`
     * * '/users/login','/users/logout','/users/register','/users/forgot' -- user_handler.user_sessions_processing
     * * /users/secondary/:action  -- `transition_processing.secondary_transition_handler`
     * 
     * @param {object} conf_obj 
     */
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
            this.app.responder(res).status(code).send(data)
        });

        // TRANSITIONS  - TRANSITION ACCEPTED  -- the body should send back the token it got with the asset.
        this.app.post('/secondary/transition',async (req, res) => {
            let body = req.body
            //
            let [code,data] = await this.transition_processing.secondary_transition_handler(body) 
            this.app.responder(res).status(code).send(data)
        })


        // let setup_foreign_auth = false /// conf_obj.foreign_auth.allowed
        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
        if ( conf_obj.login_app  && Array.isArray(conf_obj.login_app) ) {   // LOGIN APPS OPTION (START)
        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

        /*
            if ( setup_foreign_auth ) {
                setup_foreign_auth = (ws) => { this.user_handler.foreign_auth_initializer(ws) }
            }
        */

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
                    this.app.responder(res).status(code).send(result)
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
                this.app.responder(res).status(code).send(result)
            })

        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
        }       // LOGIN APPS OPTION (END)
        // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

    }


    // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
    //       // RUN AND STOP
    // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

    /**
     * The web server will start running.
     * Before listening, finalize the DB initialization.
     * Once listening, complete the initialization of the web socket service if it is being used.
     */
    run() {
        // APPLICATION STARTUP
        this.db.last_step_initalization()
        this.app.listen(this.port,() => {
            console.log(`listening on ${this.port}`)
            if ( this.web_sockets ) {
                this.web_sockets.final()
            }
        });
    }


    /**
     * Establish the signal handler that will allow an external process to bring this process down.
     * The handler will shutdown the DB and wait for the DB shutdown to complete. 
     * In many cases, the DB will write final data to the disk before disconnecting.
     * Then, use the shutdown manager to clear out any connections and timers. 
     * Finally, exit the process.
     */
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


/**
 * 
 */
function generate_password_block() {
    //
    var passwords = passwordGenerator.generateMultiple(PASSWORD_BLOCKSIZE, {
        length: 10,
        uppercase: false
    });
    //
    g_password_store = g_password_store.concat(passwords)
}


/**
 * 
 * @param {caller_dir|undefined} caller_dir 
 * @returns {string} - the directory from which the mod path modules will be loaded.
 */
function module_top(caller_dir) {
    if ( typeof caller_dir === "string" ) {
        return caller_dir
    }
    return process.cwd()
}


/**
 * Load the configuration. Called by `load_parameters`. 
 * It is absolutely required that there be a configuration file for any application using this module.
 * 
 * Pleases refer to documentation referened in the readme.md file for a description of the configuration file.
 * 
 * @param {string} cpath 
 * @param {boolean} if_module_top 
 * @returns {object} if successful, the configuration object made from reading and parsing the file
 */
function load_configuration(cpath,if_module_top) {
    cpath = cpath.trim()
    try {
        let conf = fs.readFileSync(cpath,'ascii').toString()
        return conf
    } catch (e) {
        console.log(`Error loading configuration ${cpath}... trying another candidate path`)
        console.log(e)
        let cpath2 = '' + cpath
        while ( cpath2[0] === '.' ) {
            cpath2 = cpath2.substring(1)
        }
        cpath2 = process.cwd() + '/' + cpath2
        try {
            let conf = fs.readFileSync(cpath2,'ascii').toString()
            return conf    
        } catch (e2) {
            if ( if_module_top ) {
                console.log(`Error loading configuration ${cpath2}... trying another candidate path`)
                let cpath3 = module_top(if_module_top) + '/' + cpath
                try {
                    let conf = fs.readFileSync(cpath3,'ascii').toString()
                    return conf    
                } catch (e3) {
                    console.log(`Error loading configuration ${cpath3}... failing`)
                    console.log(e)            
                }        
            }
        }
    }
    throw new Error(`could not find the file ${cpath}`)
}

/**
 * 
 * @param {object} config 
 * @param {boolean} if_module_top 
 * @returns {object} - the updated configuration object
 */
function load_parameters(config,if_module_top) {
    //
    global.g_debug = false
    //
    //
    // clonify
    global.clonify = (obj) => {
        return(clone(obj))
        /*
        if ( typeof obj == "object" ) {
            return(JSON.parse(JSON.stringify(obj)))
        }
        return(obj)
        */
    }

    // global_appwide_token
    global.global_appwide_token = () => {      // was uuid -- may change
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
         });
    }

    // isHex
    global.isHex = (str) => {
        let check = g_hex_re.test(str)
        g_hex_re.lastIndex = 0; // be sure to reset the index after using .text()
        return(check)
    }


    // do_hash
    if ( config.session_token_hasher ) {
        global.do_hash = require(config.session_token_hasher)
        config.session_token_hasher = global.do_hash // pass on the override
    } else {
        global.do_hash = (text) => {
            const hash = crypto.createHash('sha256');
            hash.update(text);
            let ehash = hash.digest('base64url');
            return(ehash)
        }
    }
    

    // global_hasher
    if ( config.global_hasher ) {
        global.global_hasher = require(config.global_hasher)
        config.global_hasher = global.global_hasher // pass on the override
    } else {
        global.global_hasher = (str,specials) => {               // global_hasher(user_str,ipfs) // can ask to store the record on chain...
            if ( str ) {
                return do_hash(str)
            }
            return('')
        }
    }

    
    generate_password_block()

    // generate_password
    global.generate_password = () => {
        let password = g_password_store.shift()
        if ( g_password_store.length < PASSWORD_DEPLETION_MIN ) {
            setTimeout(generate_password_block,100)
        }
        return(password)
    }


    global.global_shutdown_manager = new ShutdownManager()

    try {
        let data = load_configuration(config,if_module_top)
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
                    confJSON.mod_path[mname] =  module_top(if_module_top) + `/${module_path}/${modName}`
                } else {
                    confJSON.mod_path[mname] = __dirname + `/defaults/lib/default_${mname}`
                }
            } else if ( typeof modName === 'object' ) {  // allow for modules from other locations
                modName = modName.module
                let alternate_mod_path = modName.mod_path   // perhaps filter this in the future to attain some standard in locations..
                confJSON.mod_path[mname] = module_top(if_module_top) + `/${alternate_mod_path}/${modName}`
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
