const { GeneralAuth, SessionManager } = require.main.require('./lib/general_auth')
//
//const expressSession = require('express-session');
const cookieParser = require('cookie-parser');
//const uuid = require('uuid/v4');

var cnt = 0

class CaptchaSessionManager extends SessionManager {

    constructor(exp_app,db_obj,bussiness) {
        //
        super(exp_app,db_obj,bussiness)         //
        //  ----  ----  ----  ----  ----  ----  ----  ----  ----
        this.middle_ware.push(cookieParser())           // use a cookie parser
    }

    app_set_user_cookie(res,session_token) {   // express token here
        if ( res ) {
            res.cookie(this.user_cookie,session_token, { maxAge: this.max_age_user_cookie, httpOnly: true });
        }
    }
    //
    app_user_release_cookie(res) {
        if ( res ) {
            res.clearCookie(this.user_cookie); // delete the cookie
        }
    }
    //
    set_cookie(res,cookie_id,value,age) {
        if ( res ) {
            res.cookie(cookie_id,value, { maxAge: age, httpOnly: true });
        }
    }
    //
    release_cookie(res,cookie_id) {
        if ( res ) {
            res.clearCookie(cookie_id);
        }
    }

    // ----/ ----/ ----/ ----/ ----/ ----/ ----/ ----/ ----/ ----
    async hash_pass(password) {
        return(global_hasher(password))
    }

    // ----/ ----/ ----/ ----/ ----/ ----/ ----/ ----/ ----/ ----
    async password_check(db_password,client_password) {
        if ( db_password === client_password ) {
            return(true)
        }
        return(false)
    }



    async ipfs_process_user(user_op,post_body,req,res,primary_key) {

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
                        //
                        if ( user.cid === post_body.cid ) {
                            //
                            transtion_object.secondary_action = true
                            let key_key = this.key_for_user()
                            transtion_object._t_u_key = key_key
                            transtion_object.user_key = user[key_key]
                            this.loginTransitionFields(transtion_object,post_body,user)
                            let [wkey,aes_key] = await this.gen_wrapped_key(user.public_key)
                            transtion_object.wrapped_key = wkey
                            let challenge = gen_nonce()
                            transtion_object.ctext = await this.cipher(challenge,aes_key)
                            transtion_object.elements["clear"] = challenge
                            transtion_object.elements["verify_key"] = user.signer_public_key
                            //
                        }
                    } else {
                        transtion_object.amelioritive_action = this.login_amelioration
                    }
                }
                break;
            }
            case 'logout' : {
                return super.process_user(user_op,post_body,req,res,primary_key)
            }
            case 'register' : {
                if ( this.db ) {
                    let user = await this.db.fetch_user(post_body)  // is this service dealing with this user?...
                    if ( !(user) ) {
                        if ( post_body.cid ) {
                            let user_ipfs = await this.db.fetch_user_ipfs(post_body)
                            await this.db.store_user(user_ipfs)         /// CREATE USER ENTRY IN DB
                            if ( this.business ) this.business.process('new-user',post_body)
                            transtion_object.secondary_action = false
                            transtion_object.token = 'user+' + uuid()   // transaction token
                            // sha255 hash - unless application override of hashable field from config. (example uses email and password)
                            let registration_token = this.do_hash(post_body[this.hashables.field1] + post_body[this.hashables.field2])
                            transtion_object.session_token = 'sess+' + registration_token
                            transtion_object.elements = { "match" : 'sess+' + registration_token }  // will look for this...
                            break;
                        }
                    }
                }
                transtion_object.amelioritive_action = this.registration_fail_amelioration
                break;
            }
            default : {
                break;
            }
        }

        return(transtion_object)
    }



    // //
    async process_user(user_op,body,req,res) {
        this.set_cookie(res,'copious+tester',`yozie-dozie${cnt++}`,60000)
        let pkey = G_users_trns.primary_key()
        if ( user_op === 'register' ) {
            G_users_trns.tracking(body)
        }
        let transtionObj = await this.ipfs_process_user(user_op,body,req,res,pkey)
        // at this point the transition object has two tokens...
        if ( G_users_trns.action_selector(user_op) ) {
            transtionObj[pkey] = body[pkey]
        } else {
            if ( user_op === 'logout' ) {
                // req.logout() // an express app method...
            }
        }
        return(transtionObj)
    }

    //  process_asset(asset_id,post_body) {}
    feasible(transition,post_body,req) {                // is the transition something that can be done?
        if (  G_captcha_trns.tagged(transition) || G_contact_trns.tagged(transition) ) {
            return(true)
        } else if ( G_password_reset_trns.tagged(transition ) ) { //G_password_reset_trns
            if ( (post_body.trackable !== undefined ) && (this.db !== undefined) ) {
                return true
            }
            return(false)
        }
        return(super.feasible(transition,post_body,req))
    }

    //
    async process_transition(transition,post_body,req) {
        //
        let trans_object = super.process_transition(transition,post_body,req)
        //
        if ( G_captcha_trns.tagged(transition) ) {
            post_body._uuid_prefix =  G_captcha_trns.uuid_prefix()
        } else if ( G_contact_trns.tagged(transition) ) {
            trans_object.secondary_action = false
        } else if ( G_password_reset_trns.tagged(transition) ) {
            trans_object.secondary_action = false
            trans_object.token = post_body.trackable
        }
        //
        return(trans_object)
    }

    //
    async match(post_body,transtion_object)  {
        if ( G_captcha_trns.tagged(transtion_object.tobj.asset_key) ) {
            post_body._t_match_field = post_body[G_captcha_trns.match_key()]
        } else if ( G_users_trns.action_selector(transtion_object.action) ) {
            post_body._t_match_field = post_body[G_users_trns.match_key()]
        } else if ( G_users_trns.secondary_action_selector(transtion_object.action) ) {
            if ( user_op === 'login' ) {    // ----
                // 
                let signature = post_body.signature
                let clear_data = transtion_object.elements["clear"]
                let verify_key = transtion_object.elements["verify_key"]
                let OK = await this.verify(signature,clear_data,verify_key)
                return OK
            } else {
                post_body._t_match_field = post_body[G_users_trns.secondary_match_key()]
            }
        } else {
            return false
        }
        return super.match(post_body,transtion_object)
    }

    //
    async finalize_transition(transition,post_body,elements,req) {
        if ( G_captcha_trns.tagged(transition) ) {
            if ( post_body._t_match_field ) {
                super.update_session_state(transition,post_body,req)
                let finalization_state = {
                    "state" : "captcha-in-flight",
                    "OK" : "true"
                }
                // set a cookie for use by other micro services
                return(finalization_state)
            }
        } else if ( G_contact_trns.tagged(transition) ) {
            this.db.store(transition,post_body)
            let finalization_state = {
                "state" : "stored",
                "OK" : "true"
            }
            return(finalization_state)
        } else if ( G_password_reset_trns.tagged(transition) ) {
            post_body._t_u_key = G_password_reset_trns.primary_key()
            let pkey = await this.update_user_password(post_body)
            if ( pkey ) {
                this.business.cleanup(transition,pkey,post_body)
            }
            let finalization_state = {
                "state" : "stored",
                "OK" : pkey ? "true" : "false"
            }
            return(finalization_state)
        }

        let finalization_state = {
            "state" : "ERROR",
            "OK" : "false"
        }
        return(finalization_state)
    }

    //
    which_uploaded_files(req,post_body) {
        if ( req ) {
            let files = req.files
            return(files)      // the application should handle this
        }
        return([])
    }

    //
    update_session_state(transition,session_token,req) {    // req for session cookies if any
        if (  G_users_trns.action_selector(body.action) ) {
            this.addSession(req.body.email,session_token)
            res.cookie(this.user_cookie, session_token, { maxAge: 900000, httpOnly: true });
        } else {
            return super.update_session_state(transition,session_token,req)
        }
        return true
    }

    // 
    sess_data_accessor() {
        return  G_users_trns.sess_data_accessor()
    }

    //
    key_for_user() {    // communicate to the general case which key to use
        let key_key = G_users_trns.kv_store_key()
        return(key_key)
    }

    //
    async initialize_session_state(transition,session_token,transtionObj,res) {
        if ( G_users_trns.tagged('user') ) {        // application gives the correct field to the general initialize_session_state
            transtionObj._t_u_key = G_users_trns.session_key()
            transtionObj._db_session_key = transtionObj[transtionObj._t_u_key]
            return await super.initialize_session_state(transition,session_token,transtionObj,res)
        }
        return undefined
    }

}

class CaptchaAuth  extends GeneralAuth {
    constructor() {
        super(CaptchaSessionManager)   // intializes general authorization with the customized session manager class.
    }
}

var session_producer = new CaptchaAuth()
module.exports = session_producer;





   