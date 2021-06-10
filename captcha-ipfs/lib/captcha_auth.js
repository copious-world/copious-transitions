const { GeneralAuth, SessionManager } = require.main.require('./lib/general_auth')
//
//const expressSession = require('express-session');
const cookieParser = require('cookie-parser');
//const uuid = require('uuid/v4');

const { Crypto } = require('node-webcrypto-ossl')
const crypto = new Crypto()
var g_crypto = crypto.subtle; //webcrypto.crypto.subtle


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



    async gen_cipher_key() {
        //
        try {
            let aes_key = g_crypto.generateKey({
                                                    name: "AES-CBC",
                                                    length: 256
                                                },
                                                true,
                                                ["encrypt", "decrypt"]
                                            )	

            return aes_key
        } catch(e){}
        //
        return false
    }


    async aes_encryptor(encodable,aes_key,nonce) {

        let enc = new TextEncoder();
        let clear_buf =  enc.encode(encodable);
        let iv = nonce
    
        let ciphertext = await g_crypto.encrypt({
                                                    name: "AES-CBC",
                                                    iv
                                                },
                                                aes_key,
                                                clear_buf
                                            );
        return ciphertext
    }


    async key_wrapper(key_to_wrap,pub_wrapper_key) {
        try {
            let wrapper_jwk = JSON.parse(pub_wrapper_key)
            let wrapper = await g_crypto.importKey(
                    "jwk",
                    wrapper_jwk,
                    {   //these are the wrapping key's algorithm options
                        name: "RSA-OAEP",
                        modulusLength: 4096, //can be 1024, 2048, or 4096
                        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
                        hash: { name: "SHA-256" }, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
                    },
                    true,
                    ["wrapKey"]
            );
    
            let wrapped_key = await g_crypto.wrapKey(
                                                "jwk",
                                                key_to_wrap,
                                                wrapper,
                                                {   //these are the wrapping key's algorithm options
                                                    name: "RSA-OAEP"
                                                }
                                            );
            let type8 = new Uint8Array(wrapped_key)
            let tranportable = hex_fromTypedArray(type8)
            return tranportable
        } catch(e) {
            console.log(e)
        }
        return false
    }

    //
    async gen_wrapped_key(wrapper_public_key) {  // generate a wrapped aes key...
        let aes_key = await this.gen_cipher_key()
        let wrapped_key = await key_wrapper(aes_key,wrapper_public_key)
        return wrapped_key  // let descendants implement
    }

    //
    async cipher(clear_text,aes_key,nonce) {
        let enecrypted =  await this.aes_encryptor(clear_text,aes_key,nonce)
        return enecrypted               // let descendants implement
    }

    //
    async verifier(was_signed_data,signature,signer_pub_key) {
        try {
            let signer_jwk = JSON.parse(signer_pub_key)
            let verifier = await g_crypto.importKey(
                    "jwk",
                    signer_jwk,
                    {
                        'name': "ECDSA",
                        'namedCurve': "P-384"
                    },
                    true,
                    ["verify"]
            );
            //
            let enc = new TextEncoder();
            let verifiable = enc.encode(was_signed_data);
    
            let sig_bytes = hex_toByteArray(signature)
    
            let result = await g_crypto.verify({
                                                name: "ECDSA",
                                                hash: {name: "SHA-384"},
                                            },
                                            verifier,
                                            sig_bytes,
                                            verifiable
                                        );
            return result
        }  catch(e) {
            console.log(e)
        }
    }


    foreign_auth(post_body) {  // check that it is in supported strategies
        return( false )
    }

    // // 
    async login_transition(user,transtion_object,post_body) {
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
            let iv_nonce = gen_nonce()
            transtion_object.ctext = await this.cipher(challenge,aes_key,iv_nonce)
            transtion_object.iv_nonce = iv_nonce
            transtion_object.elements["clear"] = challenge
            transtion_object.elements["verify_key"] = user.signer_public_key
            //
        }
    }

    // // 
    async registration_transition(post_body,transtion_object) {
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
            return true;
        }
        return false
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
            if ( user_op === 'login' ) {    // ----
                let signature = post_body.signature
                let clear_data = transtion_object.elements["clear"]
                let verify_key = transtion_object.elements["verify_key"]
                let OK = await this.verifier(clear_data,signature,verify_key)
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





   