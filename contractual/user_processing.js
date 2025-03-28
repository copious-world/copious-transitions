
const LocalTObjectCache = require('../default_storage/local_object_cache')

/**
 * The user handling operations deal with registration, login, logout and some supporting pathways.
 * 
 * The main method of this class is `user_sessions_processing` which takes a `user_op` parameter, a string, 
 * which can be one of 'register', 'login', or 'logout'. 'forgot' has been available in the past for forgotten passwords,
 * but other processes can handle the operation. Also, with a greated emphasis on using DIDs, passwords will not be stored 
 * in the better supported applications derived by extending the classes in lib.
 * 
 * All the methods take a requests for managing a user session and decide how the request should be handled based on calls to the application
 * session manager. The operations 'register' and 'login' will require secondary actions. The operation 'logout' can be done 
 * in response to a single request.
 * 
 * 
 * 
 * @memberof Contractual
 */
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

    /**
     * This method does much of its work by calling out to the session managers method `process_user`.
     * For login and registration, most session initiation implementations could be expected to use a secondary action.
     * 
     * There is a call to the validator. For a number of applications, the validator checks on password consistency, 
     * the syntactic structure of entries, etc. In some applications, the use of the validator is moot and it returns **true**
     * by default.
     * 
     * In the case where one no secondary action will be user, the method `process_user` will perform the entire operation, 
     * such as logging out a user.
     * 
     * Otherwise, a response is sent to the requesting client immediately. And, the response will contain
     * the data necessary to let the client set up a match in the secondary action. An example would be the data and public key
     * necessary for a cryptographic signature.
     * 
     * @param {string} user_op - one of 'login', 'logout', 'register'
     * @param {object} body 
     * @returns {Array} - a tupple really, that has: 1) the status code, 2) the JSON response, 3) possibly data or boolean (false for not in use)
     */
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

    /**
     * For a few types of user operations, a seconday action will be required. 
     * 
     * The method `user_sessions_processing` must have set up match data and stored it in cache within the transition object 
     * mapped by the `token` riding wih the body.
     * 
     * One simple check that is done before all others is that the cached transition object should have the same action value as the
     * action parameter. If it does the operation continues. Next, this method suffixes transition object's action field with '-secondary'
     * telling the ensuing operations of the session manager that the operation is secondary.
     * 
     * The `match` method is called next. In some application this may be a simple equivalence check on the password field against 
     * a field in a stored user record. In other applications, it may be a cryptographic signature verification using data 
     * fromm the cached transition, data that was not sent to the requesting client.
     * 
     * If the `match` passes, then the reserved session key will be taken out of the session token stash. Given that the session token
     * can be retrieved, it will be used to initialize a user session by being passed to the session manager's method 
     * `initialize_session_state`. `initialize_session_state` may be useful enough in applications that will not have to be overridden.
     * But, the application's session manager may update it with an override. The application will most likley override `match`.
     * 
     * 
     * @param {string} action - one of 'register' or 'login'
     * @param {object} body 
     * @returns {Array} - a tupple really, that has: 1) the status code, 2) the JSON response, 3) possibly data or boolean (false for not in use)
     */
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


    /**
     * (Deprecated)
     * 
     * The purpose of this method is to provide a primary action for login's that are started by other serivces. 
     * For instance, Big Company X may provide a login that we should trust.
     * Foreign login was tested for this stack. But, more resources are being put into distirbuted identities.
     * 
     * 
     * This method is reached by a pathway within `user_sessions_processing`
     * 
     * @param {object} transitionObj 
     * @param {string} foreign 
     */
    manage_foreign_auth_session(transitionObj,foreign) {
        if ( this.transition_engine && this.transition_engine.foreign_auth_prep ) {
            this.transition_engine.foreign_auth_prep(transitionObj.token)
            transitionObj.windowize = foreign       // provide the url for the page to use for auth    
        }
    }


    // If the current stack accepts foreign auth, then process it here...
    /**
     * (Deprecated)
     * 
     * The purpose of this method is to provide a secondary action for login's that are started by other serivces. 
     * For instance, Big Company X may provide a login that we should trust.
     * Foreign login was tested for this stack. But, more resources are being put into distirbuted identities.
     * 
     * @param {object} body 
     * @param {string} token 
     * @returns {Array} - a tupple really, that has: 1) the status code, 2) the JSON response, 3) possibly data or boolean (false for not in use)
     */
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



    /**
     * This method calls upon the 'logout' pathway handled by the session manager's `process_user`. 
     * 
     * @param {object} body - similar to the body from HTTP requests, but delivered by a web socket...(rides on top of HTTP)
     */
    async sitewide_logout(body) {
        return await this.session_manager.process_user('logout',body,null,null)
    }

}


module.exports = UserHandling