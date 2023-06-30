//
const {GeneralAuth,SessionManager_Lite} = require('./general_auth_session_lite')
// Top level of session managers, effectively supplying an interface for intialization
// Does some heavy lifting in controlling the flow of authorization and permission.
//


/** 
 * @extends SessionManager_Lite from general_auth_session_lite
 * Provide the methods that will process login, registration, logout, and session initalization.
 * Also, there are methods dealing with the existene of the user and possible database storage of the user.
 */
class SessionManager extends SessionManager_Lite {
    //
    constructor(exp_app,db_obj,business) {  // reference to the DB and initializes the a middleware vector
        super(exp_app,db_obj,business)
        //
        //
        let conf = this.conf
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

    sess_data_accessor() {  // likely to be overridden e.g. "_tracking"
        return "app_user_data"
    }

    async password_check(db_password,client_password) {
        return(db_password === client_password)  /// app should override this with a secure password check
    }

    // default behavior -- should override
    hash_pass(password) {
        return(password)
    }


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


    async login_transition(user,transtion_object,post_body) {
        if ( user.password && post_body.password ) {
            let post_pass = await this.hash_pass(post_body.password)
            if ( await this.password_check(user.password,post_pass) ) {
                transtion_object.secondary_action = true
                let key_key = this.key_for_user() // a field name
                //
                transtion_object._t_u_key = key_key
                transtion_object.user_key = user[key_key]
                //
                await this.loginTransitionFields(transtion_object,post_body,user)
                return false
            } else {
                return this.password_fail_amelioration
            }
        }
    }


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

    ok_forgetfulness(boolVal,transtion_object) {
        transtion_object.forgetfulness_proceed = boolVal
    }

    app_set_user_cookie(res,session_token) {
        // application override
    }

    app_user_release_cookie(res) {/* application only */}

    
    // -- only available in the general_auth which should only be used in processes that are processing users.
    // this is not in the auth_session_lite, which is used by processes checking user ownership and permissions,
    // but those processes do not initiate user sessions or offer processing for new entries....
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
                            this.addSession(transtionObj._db_session_key,session_token,transtionObj.token)  // goes to shared memory, key-value, etc.
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
