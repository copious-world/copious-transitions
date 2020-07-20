const { GeneralAuth, SessionManager } = require.main.require('./lib/general_auth')
//
const expressSession = require('express-session');
const cookieParser = require('cookie-parser');
const uuid = require('uuid/v4');


class CaptchaSessionManager extends SessionManager {

    constructor(exp_app,db_obj,bussiness) {
        //
        super(exp_app,db_obj,bussiness)         //
        //  ----  ----  ----  ----  ----  ----  ----  ----  ----
        //
        let db_store = db_obj.session_store.generateStore(expressSession)  // custom application session store for express 
        //
        this.session = expressSession({         // express session middleware
            secret: this.conf.sessions.secret,
            resave: true,
            saveUninitialized: true,
            proxy : true,
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: false,
            genid: (req) => {
                return uuid() // use UUIDs for session IDs
            },
            store: db_store,
            cookie: {
                secure: false,
                httpOnly: true,
                domain: this.conf.domain
            }
        })
        //
        this.middle_ware.push(cookieParser())           // use a cookie parser
        this.middle_ware.push(this.session)             // this is where the session object is introduced as middleware
        let access_session_from_res = (req, res, next) => {
            res.locals.session = req.session;   // for apps using sessions...
            next();
          }
        this.middle_ware.push(access_session_from_res)
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


    // //
    async process_user(user_op,body,req,res) {
        let pkey = G_users_trns.primary_key()
        let transtionObj = await super.process_user(user_op,body,req,res,pkey)
        if ( G_users_trns.action_selector(user_op) ) {
            transtionObj[pkey] = body[pkey]
        } else {
            if ( user_op === 'logout' ) {
                // req.logout() // an express app method...
            }
        }
        return(transtionObj)
    }

    //process_asset(asset_id,post_body) {}
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
    match(post_body,transtion_object)  {
        if ( G_captcha_trns.tagged(transtion_object.tobj.asset_key) ) {
            post_body._t_match_field = post_body[G_captcha_trns.match_key()]
        } else if ( G_users_trns.action_selector(transtion_object.action) ) {
            post_body._t_match_field = post_body[G_users_trns.match_key()]
        } else if ( G_users_trns.secondary_action_selector(transtion_object.action) ) {
            post_body._t_match_field = post_body[G_users_trns.secondary_match_key()]
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


    app_set_user_cookie(res,session_token) {
        res.cookie(this.user_cookie,session_token, { maxAge: this.max_age_user_cookie, httpOnly: true });
    }
    //
    app_user_release_cookie(res) {
        res.clearCookie(this.user_cookie); // delete the cookie
    }
    //
    set_cookie(res,cookie_id,value,age) {
        res.cookie(cookie_id,value, { maxAge: age, httpOnly: true });
    }
    //
    release_cookie(res,cookie_id) {
        res.clearCookie(cookie_id);
    }

    which_uploaded_files(req,post_body) {
        let files = req.files
        return(files)      // the application should handle this
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
        if ( G_users_trns.tagged('user') ) {
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





   