//
const { GeneralAuth, SessionManager } = require.main.require('./lib/general_auth_session_lite')
const expressSession = require('express-session');
const cookieParser = require('cookie-parser');
const uuid = require('uuid/v4');


class DashboardSessionManager extends SessionManager {

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


    //process_asset(asset_id,post_body) {}
    feasible(transition,post_body,req) {                // is the transition something that can be done?
        if (  G_dashboard_trns.tagged(transition) ) {
            return(true)
        }
        return(super.feasible(transition,post_body,req))
    }

    //
    async process_transition(transition,post_body,req) {
        let trans_object = super.process_transition(transition,post_body,req)
        if ( G_dashboard_trns.tagged(transition) ) {
            post_body._uuid_prefix =  G_dashboard_trns.uuid_prefix()
        }
        return(trans_object)
    }

    //
    match(post_body,transtion_object)  {
        if ( G_dashboard_trns.tagged(transtion_object.tobj.asset_key) ) {
            post_body._t_match_field = post_body[G_captcha_trns.match_key()]
        }
        return super.match(post_body,transtion_object)
    }

    //
    async finalize_transition(transition,post_body,elements,req) {
        if ( G_dashboard_trns.tagged(transition) ) {
            if ( post_body._t_match_field ) {
                super.update_session_state(transition,post_body,req)
                let finalization_state = {
                    "state" : "captcha-in-flight",
                    "OK" : "true"
                }
                // set a cookie for use by other micro services
                return(finalization_state)
            }
        }
        let finalization_state = {
            "state" : "ERROR",
            "OK" : "false"
        }
        return(finalization_state)
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

    which_uploaded_files(req,post_body) {
        if ( req ) {
            let files = req.files
            return(files)      // the application should handle this
        }
        return([])
    }

    //
    update_session_state(transition,session_token,req) {    // req for session cookies if any
        return super.update_session_state(transition,session_token,req)
    }

    //
    key_for_user() {    // communicate to the general case which key to use
        let key_key = G_dashboard_trns.kv_store_key()
        return(key_key)
    }

    async guard(asset,body,req) {
        if ( asset.substr(0,'dashboard'.length) === 'dashboard' ) {
            let email = asset.substr('dashboard'.length + 1)
            if ( email.length ) {
                let token = body.token
                let active = await this.tokenCurrent(token)
                return active
            }
        } else {
            let token = body.token
            let active = await this.tokenCurrent(token)
            return active
        }
        return(true)    // true by default
    }

}

class DashboardAuth  extends GeneralAuth {
    constructor() {
        super(DashboardSessionManager)   // intializes general authorization with the customized session manager class.
    }
}

var session_checker = new DashboardAuth()
module.exports = session_checker;


