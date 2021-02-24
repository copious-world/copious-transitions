//
const { GeneralAuth, SessionManager } = require.main.require('./lib/general_auth_session_lite')
//const expressSession = require('express-session');
const cookieParser = require('cookie-parser');
//const uuid = require('uuid/v4');


class ProfileSessionManager extends SessionManager {

    constructor(exp_app,db_obj,business) {
        super(exp_app,db_obj,business)         //
        //  ----  ----  ----  ----  ----  ----  ----  ----  ----
        this.middle_ware.push(cookieParser())           // use a cookie parser
    }

    token_match(session_from_cookie,session_token) {
        // or decrypt the token from the cookie
        if ( session_from_cookie === session_token ) return(true)
        return(false)
    }

    //process_asset(asset_id,post_body) {}
    feasible(transition,post_body,req) {                // is the transition something that can be done?
        if (  G_profile_trns.tagged(transition) ) {
            return(true)
        }
        return(super.feasible(transition,post_body,req))
    }

    //
    async process_transition(transition,post_body,req) {
        let trans_object = super.process_transition(transition,post_body,req)
        if ( G_profile_trns.tagged(transition) ) {
            post_body._uuid_prefix =  G_profile_trns.uuid_prefix()
        }
        return(trans_object)
    }

    //
    match(post_body,transtion_object)  {
        if ( G_profile_trns.tagged(transtion_object.tobj.asset_key) ) {
            post_body._t_match_field = post_body[G_captcha_trns.match_key()]
        }
        return super.match(post_body,transtion_object)
    }

    //
    async finalize_transition(transition,post_body,elements,req) {
        if ( G_profile_trns.tagged(transition) ) {
            if ( post_body._t_match_field ) {
                super.update_session_state(transition,post_body,req)
                let finalization_state = {      // this has to get fancy
                    "state" : "computed",
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

    //
    app_user_check_cookie(req,session_token) {
        if ( this.user_cookie !== undefined ) {
            if ( req && (req.cookies !== undefined) ) {
                let session_from_cookie = req.cookies[this.user_cookie]
                if ( !(this.token_match(session_from_cookie,session_token)) ) {
                    return(false)
                }
            }
        }
        return(true)
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
        return super.update_session_state(transition,session_token,req)
    }

    //
    key_for_user() {    // communicate to the general case which key to use
        let key_key = G_profile_trns.kv_store_key()
        return(key_key)
    }

    //
    async guard(asset,body,req) {
        if ( asset.substr(0,'profile'.length) === 'profile' ) {
            let email = asset.substr('profile'.length + 1)
            if ( email.length ) {
                let token = body.token
                if ( !(this.app_user_check_cookie(req,token)) ) {
                    return false
                }
                let active = await this.sessionCurrent(token,email)
                return active
            }
        } else {
            let token = body.token
            let active = await this.tokenCurrent(token)
            return active
        }
        return(true)    // true by default
    }

    //
    async update_session_state(transition,post_body,req) {    // req for session cookies if any
        if ( G_profile_trns.tagged(transition) ) {
            if ( this.trans_engine && post_body.topic ) {
                let topic = post_body.topic
                if ( G_profile_trns.can_publish(topic) !== false ) {
                    // the transition engine will make use of the pub/sub system... 
                    // expect commands to go this way.. requesting changes in the backend such as a file moving directories, etc.
                    let response = await this.trans_engine.publish(topic,post_body)
                    if ( reponse === "OK" || (response.status === "OK" ) ) {
                        return true
                    }
                }
                return (false)
            }
        }
    }

}

class ProfileAuth  extends GeneralAuth {
    constructor() {
        super(ProfileSessionManager)   // intializes general authorization with the customized session manager class.
    }
}

var session_checker = new ProfileAuth()
module.exports = session_checker;


