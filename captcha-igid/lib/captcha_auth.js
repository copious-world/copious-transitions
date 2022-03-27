const { GeneralAuth, SessionManager } = require.main.require('./lib/general_auth')
//
//const expressSession = require('express-session');
const cookieParser = require('cookie-parser');
//const uuid = require('uuid/v4');

const g_crypto = require('crypto-wraps')


var cnt = 0

async function derivation_keys(sessM) {
    let axiom_pair = await g_crypto.axiom_keypair_promise()
    sessM.private_derivation = axiom_pair.privateKey
    sessM.public_derivation = axiom_pair.publicKey
}


class CaptchaSessionManager extends SessionManager {

    constructor(exp_app,db_obj,bussiness) {
        //
        super(exp_app,db_obj,bussiness)         //
        //  ----  ----  ----  ----  ----  ----  ----  ----  ----
        this.middle_ware.push(cookieParser())           // use a cookie parser
        derivation_keys(this)
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


    foreign_auth(post_body) {  // check that it is in supported strategies
        return( false )
    }


    // consult ORACLE and add this to something like a tangle...
    async loginTransitionFields(transtion_object,post_body,user) {
        transtion_object.token = 'user+' + uuid()   // this token identifies this transition object
        let nonce = '' + uuid()
        // // consult an ORACLE  (hold onto it until after handshake)
        let sess_tok = this.do_hash(post_body[this.hashables.field1] + post_body[this.hashables.field2] + nonce) // this is the session identifier just getting started.
        transtion_object.session_token = sess_tok
        transtion_object.strategy = post_body.strategy
        //
        transtion_object.elements = { "match" :  transtion_object.token }
        //
        this.stash_session_token(user,transtion_object,sess_tok)
    }

    //
    addSession(key,session_token) {
        // tell the ORACLE that this is OK 
        // after the ORACLE and service have talked....
        super.addSession(key,session_token)
        //
        // publish this session to maps outside this machine (if the db customization does not)
        // ref (see) this.db.set_session_key_value(session_token,key)
        //
    }

    // // 
    async login_transition(user,transtion_object,post_body) {
        if ( user.ucwid === post_body.ucwid ) {
            //
            transtion_object.secondary_action = true
            let key_key = this.key_for_user()
            transtion_object._t_u_key = key_key
            transtion_object.user_key = user[key_key]
            this.loginTransitionFields(transtion_object,post_body,user)
            //
            // user sends public derivation key (or is from UCWID) ... user retains private side elliptical
            //
            let local_private = this.private_derivation
            let aes_key = await g_crypto.derive_aes_key(user.public_key,local_private)
            //
            transtion_object.public_derivation = this.public_derivation // the key that will wrap the challenge
            //
            let challenge = g_crypto.gen_nonce()
            let iv_nonce = g_crypto.gen_nonce()
            // // ---- encipher the challenge
            transtion_object.ctext = await g_crypto.encipher_message(challenge,aes_key,iv_nonce)
            transtion_object.iv_nonce = iv_nonce        // send the nonce
            //
            // save clear for handshake ... the user should have sent a signer public key  (match)
            transtion_object.elements["clear"] = challenge  // save the challenge fro later
            transtion_object.elements["verify_key"] = user.signer_public_key
            //
        }
    }

    // // 
    async registration_transition(post_body,transtion_object) {
        return true
    }

    // //
    async process_user(user_op,body,res) {
        this.set_cookie(res,'copious+tester',`yozie-dozie${cnt++}`,60000)
        let pkey = G_users_trns.primary_key()
        if ( user_op === 'register' ) {
            G_users_trns.tracking(body)
        }
        let transtionObj = await super.process_user(user_op,body,res,pkey)
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

    //
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
            if ( user_op === 'login' ) {    // ----  USE VERIFICATION OF SIGNATURE
                let signature = post_body.signature     // the user has signed the clear challenge
                let clear_data = transtion_object.elements["clear"]
                let verify_key = transtion_object.elements["verify_key"]        // verify key from primary action...
                let OK = await this.verifier(clear_data,signature,verify_key)   // use the pulic verification key from the user identity
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
            this.addSession(req.body.cid,session_token)
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





   