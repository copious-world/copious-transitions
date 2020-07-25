const uuid = require('uuid/v4')
const AppLifeCycle = require("./general_lifecyle")
const fetch = require('node-fetch');
const crypto = require('crypto')

// Top level of session managers, effectively supplying an interface for intialization
// Does some heavy lifting in controlling the flow of authorization and permission.
//


class SessionManager extends AppLifeCycle {
    //
    constructor(exp_app,db_obj,business) {  // reference to the DB and initializes the a middleware vector
        super()
        //
        this.db = db_obj
        this.app = exp_app
        this.middle_ware = null
        let conf = exp_app._extract_conf()
        if ( conf ) {
            this.middle_ware = conf.middleware["session"]
        }
        if ( this.middle_ware === undefined ) {
            this.middle_ware = []
        }
        this.conf = conf
        //
        this.business = business
        this.hashables = clonify(conf.forhash)
        //
        this.goingSessions = {};
        this.goingTokens = {};
        //
        this.user_cookie = conf.user_cookie
        this.max_age_user_cookie = 90000
        this.current_auth_strategy = "local"
        this.foreign_authorizer_api_enpoint = conf.foreign_authorizer_api_enpoint
        this.login_amelioration = conf.login_amelioration
        this.password_fail_amelioration = conf.failed_password_amelioration
        this.registration_fail_amelioration = conf.failed_registration_duplicate
        this.second_login_amelioration = conf.second_login_amelioration
        this.release_session_data = {}  // if a session provides information for release on finalization, temporarily keep it here
    }

    // foreign_authorizer -- add the endpoint to the authorizer field
    foreign_authorizer(primary_key,tobj,body)  {
        tobj.foreign_authorizer_endpoint = this.foreign_authorizer_api_enpoint + '/start/' + body.strategy + '/' + body[primary_key]  + '/' + tobj.token
        return(tobj)
    }


    async password_check(db_password,client_password) {
        return(db_password === client_password)  /// app should override this with a secure password check
    }

    async end_foreign_session(user) {
        if ( this.foreign_authorizer_api_enpoint ) {
            try {
                //
                let options =  {
                    'method': 'POST',
                    'body': user
                }
                //
                await fetch(this.foreign_authorizer_api_enpoint + '/logout', options);
            } catch (e) {
                console.warn("No token from Spotify")
            }    
        }
    }


    extract_exposable_user_info(user,info) {
        return(user.name)
    }


    addSession(key,token) {
        if ( key !== undefined && token !== undefined ) {
            this.goingSessions[key] = token
            this.goingTokens[token] = key
            this.db.set_key_value(token,key)
        }
    }


    destroyToken(token) {
        var key = this.goingTokens[token];
        if ( key != undefined ) {
            try {
                delete this.goingSessions[key]
                delete this.goingTokens[token]
                this.db.del_key_value(token)
            } catch (e) {
                //
            }
        }
    }
    
    // bool
    async tokenCurrent(token) {
        //
        if ( (this.goingTokens[token] == undefined) ) {
            //
            try {
                let key = await this.db.get_key_value(token)
                //
                if ( key == null ) {
                    return(false)
                } else {
                    this.goingSessions[key] = token;
                    this.goingTokens[token] = key;
                    return true
                }
            } catch(e) { // set an error flag
                return false
            }
            //
        }
        //
        return ( true )
    }

    //
    guard(asset,req) {
        return(true)    // true by default
    }

    post_body_decode(udata) {
        for ( let key in udata ) {
            let field = udata[key]
            if ( field ) {
                field = decodeURIComponent(field)
                udata[key] = field.trim()
            }
        }
        return(udata)
    }

    // default behavior -- 
    do_hash(str) {
        return(global_hasher(str))
    }

    // default behavior -- should override
    hash_pass(password) {
        return(password)
    }

    sess_data_accessor() {
        return "app_user_data"
    }
    //
    foreign_auth(post_body) {  // check that it is in supported strategies
        return( (post_body.strategy !== undefined) && (post_body.strategy !== "local") )
    }

    loginTransitionFields(transtion_object,post_body,user) {
        transtion_object.token = 'user+' + uuid()   // this token identifies this transition object
        let sess_tok = this.do_hash(post_body[this.hashables.field1] + post_body[this.hashables.field2]) // this is the session identifier just getting started.
        transtion_object.session_token = sess_tok
        transtion_object.strategy = post_body.strategy
        //
        transtion_object.elements = { "match" :  transtion_object.token }
        //
        this.stash_session_token(user,transtion_object,sess_tok)
    }

    stash_session_token(user,transtion_object,sess_tok) {
        let app_sess_data_access = this.sess_data_accessor()
        if ( app_sess_data_access ) {
            this.release_session_data[sess_tok] = user[app_sess_data_access]
            transtion_object.elements[app_sess_data_access] = sess_tok  
        }  
    }

    unstash_session_token(elements) {
        let key = this.sess_data_accessor()
        return(elements[key])
    }

    key_for_user() {    // override this for tracking the user across of few user transitions
        return('id')
    }

    async process_user(user_op,post_body,req,res,primary_key) {
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
                        if ( this.foreign_auth(post_body) ) { // start the session
                            let key_key = this.key_for_user()
                            transtion_object._t_u_key = key_key
                            transtion_object.user_key = user[key_key]
                            this.loginTransitionFields(transtion_object,post_body,user)
                            this.foreign_authorizer(primary_key,transtion_object,post_body)
                            return(transtion_object)
                        }
                        //
                        if ( user.password && post_body.password ) {
                            let post_pass = await this.hash_pass(post_body.password)
                            if ( await this.password_check(user.password,post_pass) ) {
                                transtion_object.secondary_action = true
                                let key_key = this.key_for_user()
                                transtion_object._t_u_key = key_key
                                transtion_object.user_key = user[key_key]
                                this.loginTransitionFields(transtion_object,post_body,user)
                            } else {
                                transtion_object.amelioritive_action = this.password_fail_amelioration
                            }
                        }
                    } else {
                        transtion_object.amelioritive_action = this.login_amelioration
                    }
                }
                break;
            }
            case 'logout' : {
                if ( this.db ) {
                    let key = this.goingTokens[post_body.token]
                    let query = {}
                    query[primary_key] = key
                    let user = await this.db.fetch_user(query)
                    if ( user ) {
                        user.logged_in = false
                        if ( user.strategy !== 'local' ) {
                            this.end_foreign_session(user)
                            user.strategy = 'local'
                        }
                        this.db.update_user(user)
                    }
                    transtion_object.secondary_action = false
                    transtion_object.session_token = 'sess+gone'
                    let token = post_body.token
                    if ( token && this.tokenCurrent(token) ) {
                        this.destroyToken(token)
                        this.app_user_release_cookie(res)
                        //
                    }
                }
                break;
            }
            case 'register' : {
                if ( this.db ) {
                    let user = await this.db.fetch_user(post_body)
                    if ( !(user) ) {
                        if ( post_body.password ) {
                            post_body.password = await this.hash_pass(post_body.password)
                            if ( post_body.verify_password ) {
                                delete post_body.verify_password
                            }
                            await this.db.store_user(post_body)
                            if ( this.business ) this.business.process('new-user',post_body)
                            transtion_object.secondary_action = false
                            transtion_object.token = 'user+' + uuid()
                            let registration_token = this.do_hash(post_body[this.hashables.field1] + post_body[this.hashables.field2])
                            transtion_object.session_token = 'sess+' + registration_token
                            transtion_object.elements = { "match" : 'sess+' + registration_token }
                            break;
                        }
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

    //
    match(post_body,transtion_object)  {
        if ( post_body._t_match_field ) {
            let t_match = transtion_object.elements.match;
            if ( t_match === post_body._t_match_field ) {
                return true
            }
        }
        return false
    }


    //
    process_transition(transition,post_body,req) {  // req for any session cookies, etc.
        let suuid = '' + uuid()
        let transtion_object = {
            "token" : (post_body._uuid_prefix ? post_body._uuid_prefix : '') + suuid,
            "secondary_action" : true,
            "type" : "transition",
            "asset_key" : transition
        }
        return(transtion_object)
    }

    finalize_transition(transition,post_body,elements,req)  {
        let finalization_state = {
            "state" : "UP",
            "OK" : "true"
        }    
        return(finalization_state)   // finalization state more likely some objecg
    }

    feasible(transition,post_body,req) {            // examine the session state to see if the transition can take place
        return(false)
    }

    // --
    session_accrue_errors(category,data,err) {}

    which_uploaded_files(req,post_body) {
        return([])      // the application should handle this
    }

    upload_file(post_body,ttrans,req) {
        //
        let files = this.which_uploaded_files(post_body,req)
        if ( !files || Object.keys(files).length === 0) {
            let finalization_state = {
                "state" : "failed",
                "OK" : "false"
            }
            return finalization_state
        }
        //
        let ukey = ttrans.primary_key()
        let proto_file_name = post_body[ukey]
        let file_name_base = trans.transform_file_name(proto_file_name)
        let ext = post_body.file_type
        //
        for ( let file_key in files ) {
            let uploaded_file = files[file_key]
            let file_differentiator = ttrans.file_entry_id(file_key)
            // mv is part of the express.js system
            let store_name = `${file_name_base}${file_differentiator}.${ext}`
            let dir = ttrans.directory()
            let udata = {
                'name' : proto_file_name,
                'id-source' : ukey,
                'id' : proto_file_name,
                'pass' : '',
                'dir' : dir,
                'file' : store_name
            }
            uploaded_file.mv(dir + '/'  + store_name, (uudata,ureq) => {
                return((err) => {
                    if ( err ) {
                        this.session_accrue_errors("file-upload",uudata,err,ureq)
                    } else {
                        this.db.store("file-upload",uudata)
                    }
                });
            })(udata,req)
            //
        }
        let finalization_state = {
            "state" : "stored",
            "OK" : "true"
        }
        return finalization_state
    }

    //   assets
    process_asset(asset_id,post_body) {
        let transtion_object = {
            "token" : "nothing",
            "secondary_action" : false,
            "type" : "static_asset"
        }
        return(transtion_object)
    }


    update_session_state(transition,post_body,req) {    // req for session cookies if any
        return true
    }


    app_set_user_cookie(res,session_token) {
        // application override
    }

    app_user_release_cookie(res) {/* application only */}
    //

    set_cookie(res,cookie_id,value,age) {
        // application overried 
    }

    release_cookie(res,cookie_id) {}

    async initialize_session_state(transition,session_token,transtionObj,res) {
        if ( transition === 'user' ) {
            if ( transtionObj ) {
                if ( transtionObj.user_op === 'login' ) {
                    let user_key_val = transtionObj.user_key
                    let key_key = transtionObj._t_u_key
                    let query = {}
                    query[key_key] = user_key_val
                    let user = await this.db.fetch_user(query)
                    if ( user ) {
                        user.logged_in = true
                        user.strategy = transtionObj.strategy
                        this.db.update_user(user)
                        //
                        if ( transtionObj._db_session_key ) {
                            this.addSession(transtionObj._db_session_key,session_token)
                        }
                        //
                        if ( res ) this.app_set_user_cookie(res,session_token)   // leave it to the app to manage this construct, perhaps express, perhaps not
                        //
                        let elements = {}
                        let app_sess_data_access = this.sess_data_accessor()
                        elements[app_sess_data_access] = this.release_session_data[session_token]
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



class GenearalAuth extends AppLifeCycle {

    constructor(sessClass) {
        super()
        //
        this.db = null
        this.sessionClass = sessClass ? sessClass : SessionManager
    }

    sessions(exp_app,db_obj,bussiness) {
        let sess_m = new this.sessionClass(exp_app,db_obj,bussiness);
        this.db = db_obj
        return(sess_m)
    }

}



module.exports.GeneralAuth = GenearalAuth;
module.exports.SessionManager = SessionManager
