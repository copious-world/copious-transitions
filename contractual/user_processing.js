
const LocalTObjectCache = require('../custom_storage/local_object_cache')


class UserHandling extends LocalTObjectCache {
    //
    //
    constructor(sess_manager,validator,cache_time) {
        //
        super(cache_time)

        this.going_ws_session = {}
        //
        this.setup_foreign_auth = this.foreign_auth_initializer
        //
        this.session_manager = sess_manager
        this.validator = validator
    }

    foreign_auth_initializer(ws) {
        //
        ws.on("message",  (data, flags) => {
            let clientIdenifier = JSON.parse(data.toString());
            console.log(clientIdenifier.token)
            this.going_ws_session[clientIdenifier.token] = ws    // associate the client with the DB
        });
    
        ws.on("close", () => {
            let token = null
            for ( let tk in this.going_ws_session ) {
                if ( this.going_ws_session[tk] === ws ) {
                    token = tk
                    break
                }
            }
            if ( token ) {
                delete this.going_ws_session[token]
            }
        });
        //
    }

    send_ws_outofband(token_key,data) {
        if ( g_auth_wss && token_key ) {
            let ws = this.going_ws_session[token_key]
            if ( ws ) {
                ws.send(JSON.stringify(data));
            }
        }
    }

    //
    async user_sessions_process(user_op,body) {
        if ( this.validator.valid(body,this.validator.field_set[user_op]) ) {
            try {
                let transitionObj = await this.session_manager.process_user(user_op,body)
                // most paths require secondation action (perhaps logout doesn't) (Captch as model)
                if ( transitionObj.secondary_action || transitionObj.foreign_authorizer_endpoint ) {
                    // store elements for later matching...
                    let tObjCached = { 'tobj' : transitionObj, 'elements' : transitionObj.elements, 'action' : user_op }
                    this.add_local_cache_transition(transitionObj.token,tObjCached)
                    //
                    // don't send matching elements. They are for state matching and verification
                    delete transitionObj.elements
                    //
                    // tell the application what it needs to know so that it can respond to completion..
                    if ( transitionObj.secondary_action ) {
                        return ([200,{ 'type' : 'user', 'OK' : 'true', 'data' : transitionObj }])
                    } else if ( transitionObj.foreign_authorizer_endpoint )  {
                        if ( this.going_ws_session[transitionObj.token] ) {  // shut down a ws session if there is one
                            try {
                                this.going_ws_session[transitionObj.token].close()
                            } catch(e) {
                                //
                            }
                        }
                        this.going_ws_session[transitionObj.token] = null
                        transitionObj.windowize = transitionObj.foreign_authorizer_endpoint
                        return ([200,{ 'type' : 'user', 'OK' : 'true', 'data' : transitionObj }])
                    }
                } else {
                    return ([200,{ 'type' : 'user', 'OK' : 'true', 'data' : transitionObj }])
                }
            } catch (e) {
                return([200,{ 'type' : 'user', 'OK' : 'false', 'reason' : e.message }])
            }
        }
        return([200,{ 'type' : 'user', 'OK' : 'false', 'reason' : 'bad form' }])
    }

    async secondary_processing(action,body) {
        if ( body.token !== undefined ) {               // the token must be present -------->>
            let cached_transition = this.fetch_local_cache_transition(body.token)
            if ( (cached_transition !== undefined) && (action == cached_transition.action) ) {      // the action must match (artifac of use an array of paths)
                cached_transition.action += '-secondary'  // this is a key for the second part of an ongoing transition...
                // this is the asset needed by the client to turn on personlization and key access (aside from sessions and cookies)
                let ok_match = await this.session_manager.match(body,cached_transition)
                if ( ok_match ) {   // check the tokens and any other application specific information required
                    let transitionObj = cached_transition.tobj
                    let session_token = this.session_manager.unstash_session_token(cached_transition)  // gets info from the object
                    if ( session_token ) {  // assuming the token is there...
                        let elements = await this.session_manager.initialize_session_state('user',session_token,transitionObj)
                        return([200,{ 'type' : transitionObj.type, 'OK' : 'true', 'reason' : 'match', 'token' : session_token, 'elements' : elements  }])
                    }
                }
            }
        }
        return false
    }

    async foreign_authorizer(body,token) {
        let OK = body.success
        if ( OK ) {                                   // the token must be present
            let cached_transition = this.fetch_local_cache_transition(token)
            if ( cached_transition !== undefined ) {      // the action must match (artifac of use an array of paths)
                // this is the asset needed by the client to turn on personlization and key access (aside from sessions and cookies)
                if ( this.session_manager.match(body,cached_transition)  ) {        // check the tokens and any other application specific information required
                    cached_transition.action += '-secondary'
                    let transitionObj = cached_transition.tobj
                    let session_token = this.session_manager.unstash_session_token(cached_transition)
                    if ( session_token ) {
                        let elements = await this.session_manager.initialize_session_state('user',session_token,transitionObj,null)
                        this.send_ws_outofband(token,elements)
                        let response = { 'type' : transitionObj.type, 'OK' : 'true', 'reason' : 'match', 'token' : session_token, 'elements' : elements }
                        return [200,"OK",response]
                    }
                }
            }
        }
        return [514,"FAILED LOGIN",{ 'type' : 'secondary/action', 'OK' : 'false', 'reason' : 'missing data', 'action' : 'login', 'path' : 'user' }]
    }
    
}


module.exports = UserHandling