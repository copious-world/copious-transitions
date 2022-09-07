
const LocalTObjectCache = require('../custom_storage/local_object_cache')


class UserHandling extends LocalTObjectCache {
    //
    //
    constructor(sess_manager,validator,transition_engine,use_foreign,cache_time) {
        //
        super(cache_time)
        //
        this.use_foreign = false
        //
        this.session_manager = sess_manager
        this.validator = validator
        this.transition_engine = transition_engine
        this.use_foreign = use_foreign
        this.transition_engine = transition_engine
        //
    }

    //
    async user_sessions_processing(user_op,body) {
        if ( this.validator.valid(body,this.validator.field_set[user_op]) ) {
            try {
                let transitionObj = await this.session_manager.process_user(user_op,body)
                //
                // most paths require secondation action (perhaps logout doesn't) (Captch as model)
                let secondary = transitionObj.secondary_action      // will be true for ops doing a handshake
                let foreign =  this.use_foreign ? transitionObj.foreign_authorizer_endpoint : false
                //
                if ( secondary || foreign ) {   // configured (selected by the web page)
                    //
                    // store elements for later matching...
                    let tObjCached = { 'tobj' : transitionObj, 'elements' : transitionObj.elements, 'action' : user_op }
                    this.add_local_cache_transition(transitionObj.token,tObjCached)
                    //
                    // don't send matching elements. They are for state matching and verification
                    delete transitionObj.elements
                    //
                    // tell the application what it needs to know so that it can respond to completion..
                    if ( secondary ) {
                        //
                        return ([200,{ 'type' : 'user', 'OK' : 'true', 'data' : transitionObj }])
                        //
                    } else if ( foreign )  {  // provides details for web page action only
                        //
                        this.manage_foreign_auth_session(transitionObj,foreign)
                        return ([200,{ 'type' : 'user', 'OK' : 'true', 'data' : transitionObj }])
                        //
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
        return([514,{ 'type' : 'user', 'OK' : 'false', 'reason' : 'failed' }])
    }

    // If the current stack accepts foreign auth, then process it here...
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


    manage_foreign_auth_session(transitionObj,foreign) {
        if ( this.transition_engine && this.transition_engine.foreign_auth_prep ) {
            this.transition_engine.foreign_auth_prep(transitionObj.token)
            transitionObj.windowize = foreign       // provide the url for the page to use for auth    
        }
    }

    async sitewide_logout(handler) {
        await this.session_manager.process_user('logout',handler,null,null)
    }

}


module.exports = UserHandling