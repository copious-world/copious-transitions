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
        this.release_session_data = {}  // if a session provides information for release on finalization, temporarily keep it here
    }

    // foreign_authorizer -- add the endpoint to the authorizer field
    foreign_authorizer(primary_key,tobj,body)  {
        tobj.foreign_authorizer_endpoint = this.foreign_authorizer_api_enpoint + 'start/' + body.strategy + '/' + body[primary_key]
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
        this.goingSessions[key] = token
        this.goingTokens[token] = key
        this.db.set_key_value(token,key)
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
        return(false)
    }

    // default behavior -- 
    do_hash(str) {
        if ( str ) {
            const hash = crypto.createHash('sha256');
            hash.update(str);
            return(hash.digest('hex'))
        }
        return('')
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
        transtion_object.token = 'user+' + uuid()
        let sess_tok = this.do_hash(post_body[this.hashables.field1] + post_body[this.hashables.field2])
        transtion_object.session_token = sess_tok
        //
        transtion_object.elements = { "match" :  sess_tok }
        let app_sess_data_access = this.sess_data_accessor()
        if ( app_sess_data_access ) {
            this.release_session_data[sess_tok] = user[app_sess_data_access]
            transtion_object.elements[app_sess_data_access] = sess_tok    
        }
    }

    //
    async process_user(user_op,post_body,req,res,primary_key) {
        let transtion_object = {
            "token" : "nothing",
            "secondary_action" : false,
            "session_token" : undefined,
            "type" : "user"
        }

        switch ( user_op ) {
            case 'login' : {
                let user = await this.db.fetch_user(post_body)
                if ( user ) {
                    if ( this.foreign_auth(post_body) ) { // start the session
                        this.foreign_authorizer(primary_key,transtion_object,post_body)
                        this.loginTransitionFields(transtion_object,post_body,user)
                        return(transtion_object)
                    }
                    //
                    if ( user.password && post_body.password ) {
                        if ( await this.password_check(user.password,post_body.password) ) {
                            post_body.logged_in = true
                            this.db.update_user(post_body)
                            //
                            transtion_object.secondary_action = true
                            this.loginTransitionFields(transtion_object,post_body,user)
                        } else {
                            transtion_object.amelioritive_action = this.password_fail_amelioration
                        }
                    }
                } else {
                    transtion_object.amelioritive_action = this.login_amelioration
                }
                break;
            }
            case 'logout' : {
                if ( this.user_cookie ) {
                    var token = req.cookies[this.user_cookie]
                    if ( this.tokenCurrent(token) ) {
                        this.destroyToken(token)
                    }
                }
                let user = await this.db.fetch_user(post_body)
                if ( user ) {
                    user.logged_in = false
                    if ( user.strategy !== 'local' ) {
                        this.end_foreign_session(user)
                        user.strategy = 'local'
                    }
                    this.db.update_user(post_body)
                }
                transtion_object.secondary_action = false
                transtion_object.session_token = 'sess+gone'
                break;
            }
            case 'register' : {
                if ( this.db ) {
                    let user = await this.db.fetch_user(post_body)
                    if ( !(user) ) {
                        if ( post_body.password ) {
                            post_body.password = await this.hash_pass(post_body.password)
                            await this.db.store_user(post_body)
                            this.business.process('new-user',post_body)
                            transtion_object.secondary_action = true
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
                    if ( (this.db.fetch_user(post_body)) ) {
                        if ( this.business.process('forgot',post_body) ) {
                            this.ok_forgetfulness(true,transtion_object)
                        } else {
                            this.ok_forgetfulness(false,transtion_object)
                        }
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


    session_accrue_errors(category,data,err) {

    }

    upload_file(post_body,ttrans,req) {
        let files = req.files
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

    initialize_session_state(transition,session_token,transtionObj,res) {
        if ( transition === 'user' ) {
            this.addSession(transtionObj._db_session_key,session_token)
            res.cookie(this.user_cookie,session_token, { maxAge: this.max_age_user_cookie, httpOnly: true });
            let elements = this.release_session_data[session_token]
            delete this.release_session_data[session_token]
            return elements
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

    sessions(exp_app,db_obj) {
        let sess_m = new this.sessionClass(exp_app,db_obj);
        this.db = db_obj
        return(sess_m)
    }

}



module.exports.GeneralAuth = GenearalAuth;
module.exports.SessionManager = SessionManager
