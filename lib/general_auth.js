//
const {GeneralAuth,SessionManager_Lite} = require('./general_auth_session_lite')
// Top level of session managers, effectively supplying an interface for intialization
// Does some heavy lifting in controlling the flow of authorization and permission.
//


/** 
 * @extends SessionManager_Lite from general_auth_session_lite
 * Provide the methods that will process login, registration, logout, and session initalization.
 * Also, there are methods dealing with the existene of the user and possible database storage of the user.
 * 
 * NOTE: all the base classes in /lib return the class and do not return an instance. Explore the applications and 
 * the reader will find that the descendant modules export instances. The classes provided by copious-transitions must
 * be extended by an application.
 * 
 * @memberof base
 */
class SessionManager extends SessionManager_Lite {
    //
    constructor(exp_app,db_obj,business,trans_engine,token_storage) {   //
        super(exp_app,db_obj,business,trans_engine,token_storage)       //
        //
        let conf = this.class_conf
        this.current_auth_strategy = "local"
        //this.foreign_authorizer_api_enpoint = conf.foreign_auth.api_enpoint
        this.login_amelioration = conf.login_amelioration
        this.password_fail_amelioration = conf.failed_password_amelioration
        this.registration_fail_amelioration = conf.failed_registration_duplicate
        this.second_login_amelioration = conf.second_login_amelioration
    }

    // foreign_authorizer -- add the endpoint to the authorizer field
    /*
    foreign_authorizer(primary_key,tobj,body)  {
        tobj.foreign_authorizer_endpoint = this.foreign_authorizer_api_enpoint + '/start/' + body.strategy + '/' + body[primary_key]  + '/' + tobj.token
        return(tobj)
    }
    */

    /*
    async prep_foreign_auth(user,post_body,transtion_object) {
        let key_key = this.key_for_user()
        transtion_object._t_u_key = key_key
        transtion_object.user_key = user[key_key]
        this.loginTransitionFields(transtion_object,post_body,user)
        this.foreign_authorizer(primary_key,transtion_object,post_body)
        return(transtion_object)    
    }
    */


    /**
     *  By default this method just checks to see if two strings are equal.
     *  Applications will want to do something more sophisticated, e.g. checking a signature.
     * 
     * @param {string} db_password 
     * @param {string} client_password 
     * @returns {boolean} - true if the comparison passes 
     */
    async password_check(db_password,client_password) {
        return(db_password === client_password)  /// app should override this with a secure password check
    }


    // default behavior -- should override
    /**
     * By default, this method returns the parameter untouched. 
     * Applications may hash the password or may encrypt or decrypt in order to find a string for comparison.
     * 
     * @param {string} password 
     * @returns {string} - the hash of the password
     */
    hash_pass(password) {
        return(password)
    }


    /**
     * 
     * @param {object} transtion_object 
     * @param {object} post_body 
     * @param {object} user 
     */
    loginTransitionFields(transtion_object,post_body,user) {
        // make tokens (first the transition token and then the session token)
        let sess_tok = this.generate_session_token(post_body)
        let token = this.generate_transition_token('user+',sess_tok)
        // put the session token into the transition object in its special field
        transtion_object.set_session('sess+' + sess_tok)
        transtion_object.set_token(token) // this token identifies this transition object
        //
        transtion_object.strategy = post_body.strategy
        // 
        // Match the sessions's transition token later.
        transtion_object.elements = { "match" :  transtion_object.token }
        this.stash_session_token(user,transtion_object)   // stashing the token keeps the token with the server side transition object
    }


    /**
     * This method first checks the DB user password against password data obtained from the client.
     * Given the password check works, the transition object is flagged for a secondary action.
     * 
     * The `loginTransitionFields` is called in order to create the session identifier and store it in local in-memory 
     * hash tables.
     * 
     * @param {object} user 
     * @param {object} transtion_object 
     * @param {object} post_body 
     * @returns {boolean} - true if failed indicating that a corretive action must be done - false indicating no required action
     */
    async login_transition(user,transtion_object,post_body) {
        if ( user.password && post_body.password ) {
            let post_pass = await this.hash_pass(post_body.password)
            if ( await this.password_check(user.password,post_pass) ) {
                transtion_object.secondary_action = true
                let key_key = this.key_for_user() // a field name set by the application override of key_for_user.
                //
                transtion_object._t_u_key = key_key
                transtion_object.user_key = user[key_key]  // this data is to be cached for the secondary action
                //
                await this.loginTransitionFields(transtion_object,post_body,user)
                return false
            } else {
                return this.password_fail_amelioration
            }
        }
    }


    /**
     * This method stores a user in the data base for the first time.
     * 
     * In some applications this storing of the user is something perpetual.
     * In other applications, the user is stored newly each time with permanent identity storage happening elsewhere.
     * 
     * The registration can also create a session by calling `generate_session_token`
     * This also creates an elements map with a `match` field for the session.
     * 
     * @param {object} post_body 
     * @param {object} transtion_object 
     * @returns {boolean} The result is true if the user can be stored in the DB, false otherwise.
     */
    async registration_transition(post_body,transtion_object) {
        if ( post_body.password ) {
            post_body.password = await this.hash_pass(post_body.password)
            if ( post_body.verify_password ) {
                delete post_body.verify_password
            }
            await this.db.store_user(post_body)         /// CREATE USER ENTRY IN DB (store a relationship object)
            if ( this.business ) this.business.process('new-user',post_body)
            //
            let token = this.generate_transition_token('user+')   // transaction token
            let registration_token = this.generate_session_token(post_body)
            transtion_object.set_token(token)
            transtion_object.set_session('sess+' + registration_token)
            //
            transtion_object.add_to_elements({ "match" : 'sess+' + registration_token })
            return true;
        }
        return false
    }



    /**
     * This method is the target of user processing classes, that can be found in the contractual directory.
     * 
     * The user processing classes help with the existence of users and the management of their sessions.
     * 
     * There operations that this method handles are `login`, `logout` and `registration`.
     * 
     * Handling `forgot`, for forgotten passwords is deprecated and may become be handled by transition processing at a later date.
     * 
     * 
     * The `logout` operation leads to a call to `destroySession`.
     * 
     * The operations `login` and `register` lead to calls to their `transition` 
     * 
     * 
     * @param {string} user_op 
     * @param {object} post_body 
     * @param {object} res 
     * @param {string} primary_key 
     * @returns {object} - the transition object made for continuing the requested operation
     */
    async process_user(user_op,post_body,res,primary_key) {
        let use_ammelioration = false
        //
        let transtion_object = this.create_transition_record('user',user_op)
        //
        post_body = this.post_body_decode(post_body)

        switch ( user_op ) {
            case 'login' : {
                if ( this.db ) {
                    let all = true
                    let user = await this.db.fetch_user(post_body,all)
                    if ( user ) {
                        if ( user.logged_in ) {
                            //transtion_object.amelioritive_action = this.second_login_amelioration
                            //break;
                        }
                        //
                        use_ammelioration = await this.login_transition(user,transtion_object,post_body)
                    } else {
                        use_ammelioration = this.login_amelioration
                    }
                }
                break;
                // removed foreign auth 6/27/23
            }
            case 'logout' : {
                if ( this.db ) {
                    let key = this.token_to_key(post_body.token)  // get an ownership key (e.g. ucwid)
                    if ( key === undefined ) return;   // Logout can be requested for dead sessions...
                    let query = {}
                    query[primary_key] = key
                    let user = await this.db.fetch_user(query)
                    if ( user ) {
                        user.logged_in = false
                        this.db.update_user(user)
                    }
                    //
                    let token = post_body.token     // going to take the transition token (state graph) and get the session from it for now
                    transtion_object.clear_session()  // going to whip out the session idenitifer in the rest of execution
                    //
                    if ( token && this.sessionCurrent(token,key) ) {  // there has to be a transition token associated with managing session state transisions
                        this.destroySession(token)      // still use the transition token to get the sesion and destroy the actual sesssion references.
                        if ( res ) this.app_user_release_cookie(res)
                    }
                }
                break;
            }
            case 'register' : {
                if ( this.db ) {
                    let user = await this.db.fetch_user(post_body)
                    if ( !(user) ) {
                        let processed = await this.registration_transition(post_body,transtion_object)
                        if ( processed ) break;
                    }
                }
                use_ammelioration = this.registration_fail_amelioration
                break;
            }
            case 'forgot' : {
                if ( this.db ) {
                    let user = await this.db.fetch_user(post_body)
                    if ( user ) {
                        if ( this.business && this.business.process('forgot',post_body) ) {
                            let update_password = await this.hash_pass(post_body.password)
                            user.updates = { 'pass' : update_password }
                            this.db.update_user(user)
                            this.ok_forgetfulness(true,transtion_object)
                        } else {
                            this.ok_forgetfulness(false,transtion_object)
                        }
                    } else {
                        use_ammelioration = this.login_amelioration
                    }
                }
                break;
            }
            default : {
                break;
            }
        }

        //
        if ( use_ammelioration ) {
            transtion_object.amelioritive_action = use_ammelioration
            return(transtion_object.to_object(['amelioritive_action']))
        }
        return(transtion_object.to_object())
    }


    /**
     * This method responds to a client request by upd
     * 
     * `finalize_transition` in some applications use this method. The invokation of `finalize_transition` is typically during a 
     * secondary action and part of an active session. The token, from the stached transition object is expected in the client 
     * request data.
     * 
     * The token will map, via DB query on the key-value DB to a value to be used in the query for the user object 
     * in the user table of the DB. If the keyed value and the user can be found, then the password introduced by the 
     * client request's post body will be hashed and stored if the user object has the field `updates` set to an object 
     * containing the desired password. The update password and the post body password must check. 
     * 
     * If the passwords check out, then the user password can be updated and stored in the DB for future transactions.
     * 
     * The value this returns may be passed onto a business process, if the application is so condigured.
     * 
     * @param {object} post_body 
     * @returns {object} - the value `keyed_val` retrieved form the DB and that is mapped to the `token`.
     */
    async update_user_password(post_body) {
        if ( this.db ) {
            try {
                if ( post_body.token ) {
                    let keyed_val = await this.db.get_key_value(post_body.token)  // information that links the user to the reset password
                    if ( keyed_val ) {
                        let query = {}
                        query[post_body._t_u_key] = keyed_val
                        let user = await this.db.fetch_user(query)
                        if ( user ) {
                            if ( user.password && post_body.password ) {
                                let post_pass = await this.hash_pass(post_body.password)
                                let updates = user.updates
                                if ( updates ) {
                                    if ( await this.password_check(updates.pass,post_pass) ) {
                                        user.password = updates.pass
                                        delete user.updates.pass
                                        if ( Object.keys(user.updates).length == 0 ) delete user.updates
                                        this.db.update_user(user)
                                        return(keyed_val)
                                    }
                                }
                            }
                        }
                    }
                }
            } catch(e) {
                console.log(e)
            }
        }
        return(false)
    }


    /**
     * Set the `forgetfulness_proceed` for the applications that handle forgotten passwords.
     * 
     * @param {boolean} boolVal 
     * @param {object} transtion_object 
     */
    ok_forgetfulness(boolVal,transtion_object) {
        transtion_object.forgetfulness_proceed = boolVal
    }

    /**
     * Applications will want to override this method in order to work with cookies used by the authorization process.
     * 
     * @param {object} res - this is the HTTP request response object
     * @param {string} session_token 
     */
    app_set_user_cookie(res,session_token) {
        // application override
    }

    /**
     * Applications will want to override this method in order to work with cookies used by the authorization process.
     * 
     * @param {object} res - this is the HTTP request response object 
     */
    app_user_release_cookie(res) {/* application only */}

    /**
     * 
     * This method will start a user's session, enabling calls to asset delivery and to processess state transitions.
     * This method is called only after the session has been authorized and a session token has been created for it.
     * Also, this method only handles transition objects that have a `user_op` set to `login`.
     * 
     * Given the user object is still in the DB, the user `logged_in` field will be set to true.
     * And, this state change will be stored in the DB for reference by this and other processes.
     * 
     * Finally, the session for this user will be recorded in the session tables, and data created for the session will be released.
     * 
     * 
     * 
     * Only available in the general_auth which should only be used in processes that are processing users.
     * This is not in the auth_session_lite, which is used by processes checking user ownership and permissions,
     * but those processes do not initiate user sessions or offer processing for new entries....
     * 
     * if the user session state can be initialized, this returns the elements map required by the cached transition object.
     * 
     * @param {string} transition 
     * @param {string} session_token 
     * @param {object} transtionObj 
     * @param {object} res 
     * @returns {object|undefined} 
     */
    async initialize_session_state(transition,session_token,transtionObj,res) {
        if ( transition === 'user' ) {
            if ( transtionObj ) {
                if ( transtionObj.user_op === 'login' ) {       // finalize login....
                    let user_key_val = transtionObj.user_key
                    let key_key = transtionObj._t_u_key
                    let query = {}
                    query[key_key] = user_key_val       // find the user from the application db
                    let user = await this.db.fetch_user(query)
                    if ( user ) {       // if finding it, the log the user in (also the result of registration...)
                        user.logged_in = true
                        user.strategy = transtionObj.strategy       // foreign login may be a strategy... so is local...
                        // SEND USER TO DB as logged in...
                        this.db.update_user(user)   // update the user record with "logged_in" set to true..
                        //
                        if ( transtionObj._db_session_key ) {     // uuid --> and the sha255 hash  -- e.g. the ucwid itself
                            await this.addSession(transtionObj._db_session_key,session_token,transtionObj.token)  // goes to shared memory, key-value, etc.
                        }
                        //
                        if ( res ) this.app_set_user_cookie(res,session_token)   // leave it to the app to manage this construct, perhaps express, perhaps not
                        //
                        let elements = {}
                        let app_sess_data_access = this.sess_data_accessor()
                        elements[app_sess_data_access] = this.release_session_data[session_token]  // end of the transition...
                        delete this.release_session_data[session_token]
                        //
                        return elements        
                    }
                }
            }
        }
        return undefined
    }
}


module.exports.GeneralAuth = GeneralAuth
module.exports.SessionManager = SessionManager
