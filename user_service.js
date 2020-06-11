//
const fs = require('fs')
const crypto = require('crypto')
//
const conf_obj = load_parameters()                  // configuration parameters to select modules, etc.
// CONFIGURE
const g_db = require(conf_obj.mod_path.db)                   // The database interface. Sets up session store, static store, and other DB pathways
const g_middleware = require(conf_obj.mod_path.middleware)   // This is middleware for Express applications
const g_authorizer = require(conf_obj.mod_path.authorizer)   // Put authorization mechanics here.
const g_statics = require(conf_obj.mod_path.static_assets)   // Special handling for fetching static assets.
const g_dynamics = require(conf_obj.mod_path.dynamic_assets) // Program spends some time creating the asset.
const g_validator = require(conf_obj.mod_path.validator)     // Custom access to field specification from configuration and the application through DB or inline code
const g_business = require(conf_obj.mod_path.business)       // backend tasks that don't return values, but may send them out to other services.. (some procesing involved)
//
var g_app = require(conf_obj.mod_path.expression)(conf_obj); // exports a function

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


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

// ROOT ... unauthorized entry point
g_app.get('/', (req, res) => {
    var html = g_statics.fetch('index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
});

// STATIC FETCH
g_app.get('/static_mime/:asset', (req, res) => {
    let asset = req.params['asset']
    if ( g_session_manager.check(asset,req) ) {     // returns a true value by default, but may guard some assets
        var asset_obj = g_statics.fetch(asset);     // returns an object with fields mime_type, and string e.g. text/html with uriEncoded html
        res.writeHead(200, { 'Content-Type': asset_obj.mime_type });
        res.end(asset_obj.string);    
    } else {
        res.status(200).send(JSON.stringify( { 'type' : 'user', 'OK' : 'false', 'reason' : 'unavailable' }));
    }
});


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

// KEYED MIME_TYPES  -- no validation check on the post, so only a key is expected
let g_secondary_mime_actions = {}
g_app.post('/keyed_mime/:asset', (req, res) => {
    let asset = req.params['asset']
    if ( g_session_manager.check(asset,req) ) {             // asset exits, permission granted, etc.
        let transtionObj = g_session_manager.process_asset(asset,body)  // not checking sesion, key the asset and use any search refinement in the body.
        if ( transtionObj.secondary_action ) {                          // return a transition object to go to the client. 
            let asset_obj = g_statics.fetch(asset);                     // get the asset for later
            g_secondary_mime_actions[transtionObj.token] = { 'tobj' : transtionObj, 'asset' : asset_obj }               // store the object and the asset. 
            return(res.status(200).send(JSON.stringify({ 'type' : 'user', 'OK' : 'true', 'data' : transtionObj })));    // transition object has token
        } else {
            let asset_obj = g_statics.fetch(asset);     // no checks being done, just send the asset. No token field included
            res.writeHead(200, { 'Content-Type': asset_obj.mime_type } );
            return(res.end(asset_obj.string));
        }
    }
    res.status(200).send(JSON.stringify({ 'type' : 'mime', 'OK' : 'false', 'reason' : 'unavailable' }));
});

// KEYED MIME_TYPES  - TRANSITION ACCEPTED  -- the body should send back the token it got with the asset.
g_app.post('/keyed_mime/secondary',(req,res) => {
    let body = req.body
    if ( body.token !== undefined ) {
        let cached_transition = g_secondary_mime_actions[body.token]            // take the asset information from cache
        if ( cached_transition !== undefined ) {
            let transtionObj = cached_transition.tobj
            if ( g_session_manager.match(body,transtionObj)  ) {                // check on matching tokens and possibly other things
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
g_app.post('/transition/:transition', function(req, res){           // the transition is a name or key
    let body = req.body
    let transition = req.params.transition
    if ( g_validator.valid(body,g_validator.field_set[transition]) ) {         // A field set may be in the configuration for named transitions - true by default
        if ( g_session_manager.feasible(transition,body,req) ) {                        // can this session actually make the transition?
            let transtionObj = g_session_manager.process_transition(transition,body,req)            // either fetch or produced transition data
            if ( transtionObj.secondary_action ) {                                      // Require a seconday action as part of the transition for finalization
                let elements = g_dynamics.fetch_elements(transition,transtionObj);      // elements is purposely vague and may be application sepecific
                g_finalize_transitions[transtionObj.token] = { 'tobj' : transtionObj, 'elements' : elements, 'transition' : transition }
                return(res.status(200).send(JSON.stringify({ 'type' : 'transition', 'OK' : 'true', 'data' : transtionObj, 'elements' : elements })));
            }
        }
    }
    res.status(200).send(JSON.stringify({ 'type' : 'user', 'OK' : 'false', 'reason' : 'unavailable' }));
});

// TRANSITIONS  - TRANSITION ACCEPTED  -- the body should send back the token it got with the asset.
g_app.post('/transition/secondary',(req,res) => {
    let body = req.body
    if ( body.token !== undefined ) {
        let cached_transition = g_finalize_transitions[body.token]      // get the transition from cache
        if ( cached_transition !== undefined ) {
            let transtionObj = cached_transition.tobj
            if ( g_session_manager.match(body,transtionObj)  ) {        // check on matching tokens and possibly other things 
                let elements = cached_transition.elements
                // some kind of transition takes place and becomes the state of the session. It may not be the same as the one
                // specified in the cached transition, but may be similar depending on how types (categories) are regulated 
                let finalization_state = g_session_manager.finalize_transition(cached_transition.transition,body,elements,req)      // FINALIZE (not a final state)
                if ( finalization_state ) {     // relay the finalized transition and go on with business. 
                    return(res.status(200).send(JSON.stringify({ 'type' : 'finalize', 'OK' : 'true', 'state' : finalization_state, 'reason' : 'matched' })));
                } // else nothing worked 
            }
        }
    }
    res.status(200).send(JSON.stringify({ 'type' : 'secondary/action', 'OK' : 'false', 'reason' : 'no transition' }));
})



// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

// USER MANAGEMENT - handle authorization and user presence.
let g_secondary_user_actions = {}
g_app.post(['/users/login','/users/logout','/users/register','/users/forgot'],(req,res) => {
    let body = req.body
    let user_op = body['action']
    if ( g_validator.valid(body,g_validator.field_set[user_op]) ) {        // every post that comes through will have validation from configuration
        let transtionObj = g_session_manager.process_user(user_op,body,req)         // most paths require secondation action (perhaps logout doesn't) (Captch as model)
        if ( transtionObj.secondary_action ) {
            g_secondary_user_actions[transtionObj.token] = { 'tobj' : transtionObj, 'token' : transtionObj.session_token, 'action' : user_op }
            delete transtionObj.session_token
            return(res.status(200).send(JSON.stringify( { 'type' : 'user', 'OK' : 'true', 'data' : transtionObj })));
        } else {
            return(res.status(200).send(JSON.stringify( { 'type' : 'user', 'OK' : 'true', 'data' : transtionObj })));
        }
    }    
    res.status(200).send(JSON.stringify( { 'type' : 'user', 'OK' : 'false', 'reason' : 'bad form' }));
})
 
// USER MANAGEMENT - finalize the user action.
g_app.post('/users/secondary/:action',(req,res) => {
    let body = req.body
    let action = req.params['action']
    if ( body.token !== undefined ) {                                   // the token must be present
        let cached_transition = g_secondary_user_actions[body.token]
        if ( (cached_transition !== undefined) && (action == cached_transition.action) ) {      // the action must match (artifac of use an array of paths)
            // this is the asset needed by the client to turn on personlization and key access (aside from sessions and cookies)
            let session_token = cached_transition.session_token
            let transtionObj = cached_transition.tobj
            if ( g_session_manager.match(body,transtionObj)  ) {        // check the tokens and any other application specific information required
                g_session_manager.initialize_session_state('user',session_token,transtionObj,res)
                res.status(200).send(JSON.stringify({ 'type' : transtionObj.type, 'OK' : 'true', 'reason' : 'match', 'token' : session_token }));
                return;
            }
        }
    }
    res.status(200).send(JSON.stringify( { 'type' : 'secondary/action', 'OK' : 'false', 'reason' : 'missing data' }));
})


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

// APPLICATION STARTUP
//
g_db.last_step_initalization()
g_app.listen(conf_obj.port);


// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------
// ------------- ------------- ------------- ------------- ------------- ------------- ------------- -------------

global.clonify = clonify => (obj) {
    if ( typeof obj == "object" ) {
        return(JSON.parse(JSON.stringify(obj)))
    }
    return(obj)
}

global.do_hash = (text) => {
    const hash = crypto.createHash('sha256');
    hash.update(text);
    let ehash = hash.digest('hex');
    return(ehash)
}

function load_parameters() {

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
        __dirname + '/' 
        return(confJSON)
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}
