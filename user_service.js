//
var g_password_store = []
const PASSWORD_DEPLETION_MIN = 3
const PASSWORD_BLOCKSIZE = 100
//
const fs = require('fs')
const crypto = require('crypto')
const clone = require('clone')
const WebSocketServer = require('ws').Server;
const http = require("http");
const passwordGenerator = require('generate-password');


//
const conf_obj = load_parameters()                  // configuration parameters to select modules, etc.
const g_custom_transitions = require(conf_obj.mod_path.custom_transitions)
// SPECIAL NAMED TRANSITIONS (PATHS)
g_custom_transitions.initialize()
// CONFIGURE
const g_db = require(conf_obj.mod_path.db)                   // The database interface. Sets up session store, static store, and other DB pathways
const g_middleware = require(conf_obj.mod_path.middleware)   // This is middleware for Express applications
const g_authorizer = require(conf_obj.mod_path.authorizer)   // Put authorization mechanics here.
const g_statics = require(conf_obj.mod_path.static_assets)   // Special handling for fetching static assets.
const g_dynamics = require(conf_obj.mod_path.dynamic_assets) // Program spends some time creating the asset.
const g_validator = require(conf_obj.mod_path.validator)     // Custom access to field specification from configuration and the application through DB or inline code
const g_business = require(conf_obj.mod_path.business)       // backend tasks that don't return values, but may send them out to other services.. (some procesing involved)
//
var g_app = require(conf_obj.mod_path.expression)(conf_obj,g_db); // exports a function

//
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

// INITIALIZE
g_db.initialize(conf_obj)
g_business.initialize(conf_obj,g_db)
let g_session_manager = g_authorizer.sessions(g_app,g_db,g_business)   // setup session management, session, cookies, tokens, etc. Use database and Express api.
                                                            // sessions inializes the custom session manager determined in the application authorizer.
g_middleware.setup(g_app,g_db,g_session_manager)            // use a module to cusomize the use of Express middleware.
g_validator.initialize(conf_obj,g_db,g_session_manager)     // The validator may refer to stored items and look at other context dependent information
g_statics.initialize(g_db)                                  // Static assets may be taken out of DB storage or from disk, etc.
g_dynamics.initialize(g_db)                                 // Dynamichk assets may be taken out of DB storage or from disk, etc.

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
    var html = g_statics.fetch('index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
});

// STATIC FETCH
g_app.get('/static/:asset', (req, res) => {
    let asset = req.params['asset']
    if ( g_session_manager.guard(asset,req) ) {     // returns a true value by default, but may guard some assets
        var asset_obj = g_statics.fetch(asset);     // returns an object with fields mime_type, and string e.g. text/html with uriEncoded html
        res.writeHead(200, { 'Content-Type': asset_obj.mime_type });
        res.end(asset_obj.string);    
    } else {
        res.status(200).send(JSON.stringify( { 'type' : 'user', 'OK' : 'false', 'reason' : 'unavailable' }));
    }
});


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

// STATIC KEYED MIME_TYPES  -- no form validation, but GUARD asset within a session
let g_secondary_mime_actions = {}
g_app.post('/guarded/static/:asset', (req, res) => {
    let asset = req.params['asset']
    if ( g_session_manager.guard(asset,req) ) {             // asset exits, permission granted, etc.
        let transtionObj = g_session_manager.process_asset(asset,body)  // not checking sesion, key the asset and use any search refinement in the body.
        if ( transtionObj.secondary_action ) {                          // return a transition object to go to the client. 
            let asset_obj = g_statics.fetch(asset);                     // get the asset for later
            let tObjCached = { 'tobj' : transtionObj, 'asset' : asset_obj } 
            add_local_cache_transition(g_secondary_mime_actions,transtionObj.token,tObjCached)
            return(res.status(200).send(JSON.stringify({ 'type' : 'user', 'OK' : 'true', 'data' : transtionObj })));    // transition object has token
        } else {
            let asset_obj = g_statics.fetch(asset);     // no checks being done, just send the asset. No token field included
            res.writeHead(200, { 'Content-Type': asset_obj.mime_type } );
            return(res.end(asset_obj.string));
        }
    }
    res.status(200).send(JSON.stringify({ 'type' : 'mime', 'OK' : 'false', 'reason' : 'unavailable' }));
});

g_app.post('/guarded/dynamic/:asset', (req, res) => {
    let asset = req.params['asset']
    if ( g_session_manager.guard(asset,req) ) {             // asset exits, permission granted, etc.
        let transtionObj = g_session_manager.process_asset(asset,body)  // not checking sesion, key the asset and use any search refinement in the body.
        if ( transtionObj.secondary_action ) {                          // return a transition object to go to the client. 
            let asset_obj = g_dynamics.fetch(asset);                     // get the asset for later
            let tObjCached = { 'tobj' : transtionObj, 'asset' : asset_obj } 
            add_local_cache_transition(g_secondary_mime_actions,transtionObj.token,tObjCached)
            return(res.status(200).send(JSON.stringify({ 'type' : 'user', 'OK' : 'true', 'data' : transtionObj })));    // transition object has token
        } else {
            let asset_obj = g_dynamics.fetch(asset);     // no checks being done, just send the asset. No token field included
            res.writeHead(200, { 'Content-Type': asset_obj.mime_type } );
            return(res.end(asset_obj.string));
        }
    }
    res.status(200).send(JSON.stringify({ 'type' : 'mime', 'OK' : 'false', 'reason' : 'unavailable' }));
});

// KEYED MIME_TYPES  - TRANSITION ACCEPTED  -- the body should send back the token it got with the asset.
g_app.post('/secondary/guarded',(req,res) => {
    let body = req.body
    if ( body.token !== undefined ) {
        let cached_transition = fetch_local_cache_transition(g_secondary_mime_actions,body.token)
        if ( cached_transition !== undefined ) {
            if ( g_session_manager.match(body,cached_transition)  ) {                // check on matching tokens and possibly other things
                if ( g_session_manager.key_mime_type_transition(req) ) {
                    let asset_obj = cached_transition.data                          // Finally, send the asset 
                    res.writeHead(200, { 'Content-Type': asset_obj.mime_type } );
                    return(res.end(asset_obj.string));
                }
            }
        }
    }
    res.status(200).send(JSON.stringify( { 'type' : 'secondary/action', 'OK' : 'false', 'reason' : 'missing data' }));
})


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

// TRANSITIONS - pure state transition dynamics for sessions
let g_finalize_transitions = {}
g_app.post('/transition/:transition', async (req, res) => {           // the transition is a name or key
    let body = req.body
    let transition = req.params.transition
    if ( g_validator.valid(body,g_validator.field_set[transition]) ) {         // A field set may be in the configuration for named transitions - true by default
        if ( g_session_manager.feasible(transition,body,req) ) {                        // can this session actually make the transition?
            let transtionObj = await g_session_manager.process_transition(transition,body,req)            // either fetch or produced transition data
            if ( transtionObj.secondary_action ) {                                      // Require a seconday action as part of the transition for finalization
                let [send_elements, store_elements] = g_dynamics.fetch_elements(transition,transtionObj);      // elements is purposely vague and may be application sepecific
                let tObjCached = { 'tobj' : transtionObj, 'elements' : store_elements, 'transition' : transition }
                add_local_cache_transition(g_finalize_transitions,transtionObj.token,tObjCached)
                return(res.status(200).send(JSON.stringify({ 'type' : 'transition', 'OK' : 'true', 'transition' : transtionObj, 'elements' : send_elements })));
            } else {
                body.token = transtionObj.token
                let finalization_state = g_session_manager.finalize_transition(transition,body,{},req)      // FINALIZE (not a final state)
                if ( finalization_state ) {     // relay the finalized transition and go on with business. 
                    let state = finalization_state.state
                    let OK = finalization_state.OK
                    return(res.status(200).send(JSON.stringify({ 'type' : 'finalize', 'OK' : OK, 'state' : state, 'reason' : 'matched' })));
                }
            }
        }
    }
    res.status(200).send(JSON.stringify({ 'type' : 'user', 'OK' : 'false', 'reason' : 'unavailable' }));
});

// TRANSITIONS  - TRANSITION ACCEPTED  -- the body should send back the token it got with the asset.
g_app.post('/secondary/transition',async (req, res) => {
    let body = req.body
    if ( body.token !== undefined ) {
        let cached_transition = fetch_local_cache_transition(g_finalize_transitions,body.token)
        if ( cached_transition !== undefined ) {
            if ( g_session_manager.match(body,cached_transition)  ) {        // check on matching tokens and possibly other things 
                // some kind of transition takes place and becomes the state of the session. It may not be the same as the one
                // specified in the cached transition, but may be similar depending on how types (categories) are regulated 
                let elements = cached_transition.elements
                let finalization_state = await g_session_manager.finalize_transition(cached_transition.transition,body,elements,req)      // FINALIZE (not a final state)
                if ( finalization_state ) {     // relay the finalized transition and go on with business. 
                    let state = finalization_state.state
                    let OK = finalization_state.OK
                    return(res.status(200).send(JSON.stringify({ 'type' : 'finalize', 'OK' : OK, 'state' : state, 'reason' : 'matched' })));
                } // else nothing worked 
            }
        }
    }
    res.status(200).send(JSON.stringify({ 'type' : 'secondary/action', 'OK' : 'false', 'reason' : 'no transition' }));
})



// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
if ( conf_obj.login_app ) {   // LOGIN APPS OPTION (START)
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
// USER MANAGEMENT - handle authorization and user presence.
let g_secondary_user_actions = {}
g_app.post(['/users/login','/users/logout','/users/register','/users/forgot'], async (req,res) => {
    let body = req.body
    let user_op = body['action']
    if ( g_validator.valid(body,g_validator.field_set[user_op]) ) {        // every post that comes through will have validation from configuration
        try {
            let transtionObj = await g_session_manager.process_user(user_op,body,req,res)       // most paths require secondation action (perhaps logout doesn't) (Captch as model)
            if ( transtionObj.secondary_action || transtionObj.foreign_authorizer_endpoint ) {
                let tObjCached = { 'tobj' : transtionObj, 'elements' : transtionObj.elements, 'action' : user_op }
                add_local_cache_transition(g_secondary_user_actions,transtionObj.token,tObjCached)
                delete transtionObj.elements
                if ( transtionObj.secondary_action ) {
                    return(res.status(200).send(JSON.stringify( { 'type' : 'user', 'OK' : 'true', 'data' : transtionObj })));
                } else if ( transtionObj.foreign_authorizer_endpoint ) {
                    transtionObj.foreign_authorizer_endpoint += '/' + transtionObj.token  // token of auth process
                    transtionObj.windowize = transtionObj.foreign_authorizer_endpoint
                    return(res.status(200).send(JSON.stringify( { 'type' : 'user', 'OK' : 'true', 'data' : transtionObj })));
                }
            } else {
                return(res.status(200).send(JSON.stringify( { 'type' : 'user', 'OK' : 'true', 'data' : transtionObj })));
            }
        } catch (e) {
            return(res.status(200).send(JSON.stringify( { 'type' : 'user', 'OK' : 'false', 'reason' : 'broken server' })));
        }
    }
    //
    return(res.status(200).send(JSON.stringify( { 'type' : 'user', 'OK' : 'false', 'reason' : 'bad form' })));
    //
})


 
// USER MANAGEMENT - finalize the user action.
g_app.post('/secondary/users/:action', (req, res) => {
    let body = req.body
    let action = req.params['action']
    if ( body.token !== undefined ) {                                   // the token must be present
        let cached_transition = fetch_local_cache_transition(g_secondary_user_actions,body.token)
        if ( (cached_transition !== undefined) && (action == cached_transition.action) ) {      // the action must match (artifac of use an array of paths)
            // this is the asset needed by the client to turn on personlization and key access (aside from sessions and cookies)
            if ( g_session_manager.match(body,cached_transition)  ) {        // check the tokens and any other application specific information required
                let session_token = cached_transition.session_token
                let transtionObj = cached_transition.tobj
                let elements = g_session_manager.initialize_session_state('user',session_token,transtionObj,res)
                res.status(200).send(JSON.stringify({ 'type' : transtionObj.type, 'OK' : 'true', 'reason' : 'match', 'token' : session_token, 'elements' : elements  }));
                return;
            }
        }
    }
    res.status(200).send(JSON.stringify( { 'type' : 'secondary/action', 'OK' : 'false', 'reason' : 'missing data' }));
})


g_app.post('/foreign_login/users', (req, foreign_res) => {  // or use the websockets publication of state....
    let body = req.body
    let OK = req.params['success']
    if ( OK ) {                                   // the token must be present
        let cached_transition = fetch_local_cache_transition(g_secondary_user_actions,body.token)
        if ( cached_transition !== undefined ) {      // the action must match (artifac of use an array of paths)
            // this is the asset needed by the client to turn on personlization and key access (aside from sessions and cookies)
            if ( g_session_manager.match(body,cached_transition)  ) {        // check the tokens and any other application specific information required
                let session_token = cached_transition.session_token
                let transtionObj = cached_transition.tobj
                let elements = g_session_manager.initialize_session_state('user',session_token,transtionObj,null)
                send_ws_outofband(body.token,{ 'type' : transtionObj.type, 'OK' : 'true', 'reason' : 'match', 'token' : session_token, 'elements' : elements })
                return foreign_res.status(200).end("OK")
            }
        }
    }
    foreign_res.status(514).end("FAILED LOGIN")
    send_ws_outofband({ 'type' : 'secondary/action', 'OK' : 'false', 'reason' : 'missing data', 'action' : 'login', 'path' : 'user' })
})


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
}       // LOGIN APPS OPTION (END)
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

// APPLICATION STARTUP
//
g_db.last_step_initalization()
g_app.listen(conf_obj.port);

// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
if ( conf_obj.ws_port ) {   // WEB SCOCKETS OPTION (START)
    // ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
    

let server = http.createServer(g_app);
server.listen(conf_obj.ws_port);

var g_going_ws_session = {}

var g_auth_wss = new WebSocketServer({server: server});
g_auth_wss.on("connection", function (ws) {
    //
    var timestamp = new Date().getTime();

    ws.send(JSON.stringify({ 'msgType': 'onOpenConnection', 'msg': { 'connectionId': timestamp }  }));

    ws.on("message", function (data, flags) {
        let clientIdenifier = JSON.parse(data.toString());
        g_going_ws_session[clientIdenifier.id] = ws    // associate the client with the DB

    });

    ws.on("close", function () {
        let token = null
        for ( let tk in g_going_ws_session ) {
            if ( g_going_ws_session[tk] === ws ) {
                token = tk
                break
            }
        }
        if ( token ) {
            delete g_going_ws_session[token]
        }
    });

});


function send_ws_outofband(token_key,data) {
    if ( g_auth_wss ) {
        let ws = g_going_ws_session[token_key]
        if ( ws ) {
            g_auth_ws.send(data);
        }
    }
}


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
}       // WEB SCOCKETS OPTION (END)
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------



function fetch_local_cache_transition(cache_map,token) {
    if ( cache_map ) {
        let transObject = cache_map[token]
        delete cache_map[token]
        return transObject
    }
    return undefined
}


function add_local_cache_transition(cache_map,token,tobject) {
    if ( cache_map ) {
        cache_map[token] = tobject
        if (  tobject.tobj.session_token ) {
            delete tobject.tobj.session_token
        }
    }
}


function generate_password_block() {
    //
    var passwords = passwordGenerator.generateMultiple(PASSWORD_BLOCKSIZE, {
        length: 10,
        uppercase: false
    });
    //
    g_password_store = g_password_store.concat(passwords)
}


function load_parameters() {
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

    let config = "./user-service.conf"
    if ( process.argv[2] !== undefined ) {
        config = process.argv[2];
    }
    try {
        let confJSON = JSON.parse(fs.readFileSync(config,'ascii').toString())
        let module_path = confJSON.module_path
        confJSON.mod_path = {}
        for ( let mname in confJSON.modules ) {
            confJSON.mod_path[mname] = __dirname + '/' + module_path + '/' + confJSON.modules[mname]
        }
        return(confJSON)
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}
