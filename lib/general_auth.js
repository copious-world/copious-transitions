const uuid = require('uuid/v4')
const {GeneralAuth,SessionManager_Lite} = require('./general_auth_session_lite')
// Top level of session managers, effectively supplying an interface for intialization
// Does some heavy lifting in controlling the flow of authorization and permission.
//


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
        this.release_session_data = {}  // if a session provides information for release on finalization, temporarily keep it here
    }

    // foreign_authorizer -- add the endpoint to the authorizer field
    /*
    foreign_authorizer(primary_key,tobj,body)  {
        tobj.foreign_authorizer_endpoint = this.foreign_authorizer_api_enpoint + '/start/' + body.strategy + '/' + body[primary_key]  + '/' + tobj.token
        return(tobj)
    }
    */

    sess_data_accessor() {  // likely to be overridden e.g. "_tracking"
        return "app_user_data"
    }

    async password_check(db_password,client_password) {
        return(db_password === client_password)  /// app should override this with a secure password check
    }

    async addSession(key,session_token) {    // e.g. ucwid and server side hash
        if ( (key !== undefined) && (session_token !== undefined) ) {
            let server_side_hash = session_token
            //
            // src_key e.g. augmented hash token  OR hh unidentified (an intermediate hash)
            let src_key = await this.db.set_session_key_value(server_side_hash,key)
            this.goingSessions[src_key] = server_side_hash
            this.goingTokens[server_side_hash] = key
            //
        }
    }

    addToken(value,token) {
        if ( (value !== undefined) && (token !== undefined) ) {
            this.db.set_key_value(token,value)
            this.goingTokens[token] = value
        }
    }

    destroyToken(token) {
        let src_key = this.goingTokens[token];
        if ( src_key != undefined ) {
            try {
                delete this.goingTokens[token]
                this.db.del_key_value(token)
            } catch (e) {
                //
            }
        }
    }

    destroySession(token) {
        let src_key = this.goingTokens[token];
        if ( src_key != undefined ) {
            try {
                delete this.goingSessions[src_key]
                delete this.goingTokens[token]
                this.db.del_session_key_value(token)
            } catch (e) {
                //
            }
        }
    }

    // default behavior -- should override
    hash_pass(password) {
        return(password)
    }

    //
    /*
    foreign_auth(post_body) {  // check that it is in supported strategies
        return( (post_body.strategy !== undefined) && (post_body.strategy !== "local") )
    }
    */
   
    loginTransitionFields(transtion_object,post_body,user) {
        transtion_object.token = 'user+' + uuid()   // this token identifies this transition object
        let nonce = '' + uuid()
        let sess_tok = this.do_hash(post_body[this.hashables.field1] + post_body[this.hashables.field2] + nonce) // this is the session identifier just getting started.
        transtion_object.session_token = sess_tok
        transtion_object.strategy = post_body.strategy
        //
        transtion_object.elements = { "match" :  transtion_object.token }
        //
        this.stash_session_token(user,transtion_object,sess_tok)
    }

    stash_session_token(user,transtion_object,sess_tok) {  // sess_tok a made up token (app rule)
        let app_sess_data_access = this.sess_data_accessor()
        if ( app_sess_data_access ) {
            this.release_session_data[sess_tok] = user[app_sess_data_access]  // app overrides so that it knows this filed (ucwid)
            transtion_object.elements[app_sess_data_access] = sess_tok  // for secondary
        }  
    }

    async login_transition(user,transtion_object,post_body) {
        if ( user.password && post_body.password ) {
            let post_pass = await this.hash_pass(post_body.password)
            if ( await this.password_check(user.password,post_pass) ) {
                transtion_object.secondary_action = true
                let key_key = this.key_for_user()
                transtion_object._t_u_key = key_key
                transtion_object.user_key = user[key_key]
                await this.loginTransitionFields(transtion_object,post_body,user)
            } else {
                transtion_object.amelioritive_action = this.password_fail_amelioration
            }
        }
    }


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


    async registration_transition(post_body,transtion_object) {
        if ( post_body.password ) {
            post_body.password = await this.hash_pass(post_body.password)
            if ( post_body.verify_password ) {
                delete post_body.verify_password
            }
            await this.db.store_user(post_body)         /// CREATE USER ENTRY IN DB (store a relationship object)
            if ( this.business ) this.business.process('new-user',post_body)
            transtion_object.secondary_action = false
            transtion_object.token = 'user+' + uuid()   // transaction token
            // sha255 hash - unless application override of hashable field from config. (example uses email and password)
            let registration_token = this.do_hash(post_body[this.hashables.field1] + post_body[this.hashables.field2])
            transtion_object.session_token = 'sess+' + registration_token
            transtion_object.elements = { "match" : 'sess+' + registration_token }  // will look for this...
            return true;
        }
        return false
    }



    async process_user(user_op,post_body,res,primary_key) {
        //
        let transtion_object = {
            "token" : "nothing",
            "secondary_action" : false,
            "session_token" : undefined,
            "type" : "user",
            "user_op" : user_op
        }

        post_body = this.post_body_decode(post_body)

        switch ( user_op ) {
            case 'login' : {
                if ( this.db ) {
                    let user = await this.db.fetch_user(post_body)
                    if ( user ) {
                        if ( user.logged_in ) {
                            //transtion_object.amelioritive_action = this.second_login_amelioration
                            //break;
                        }
                        /*
                        if ( this.foreign_auth(post_body) ) { // start the session
                            return this.prep_foreign_auth(user,post_body,transtion_object)
                        }
                        */
                        //
                        await this.login_transition(user,transtion_object,post_body)
                    } else {
                        transtion_object.amelioritive_action = this.login_amelioration
                    }
                }
                break;
            }
            case 'logout' : {
                if ( this.db ) {
                    let key = this.goingTokens[post_body.token]
                    if ( key === undefined ) return;   // Logout can be requested for dead sessions...
                    let query = {}
                    query[primary_key] = key
                    let user = await this.db.fetch_user(query)
                    if ( user ) {
                        user.logged_in = false
                        this.db.update_user(user)
                    }
                    transtion_object.secondary_action = false
                    transtion_object.session_token = 'sess+gone'
                    let token = post_body.token
                    if ( token && this.sessionCurrent(token,key) ) {
                        this.destroySession(token)
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
                transtion_object.amelioritive_action = this.registration_fail_amelioration
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
                        transtion_object.amelioritive_action = this.login_amelioration
                    }
                }
                break;
            }
            default : {
                break;
            }
        }

        return(transtion_object)
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
                        if ( transtionObj._db_session_key ) {     // uuid --> and the sha255 hash
                            this.addSession(transtionObj._db_session_key,session_token)  // goes to shared memory, key-value, etc.
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
