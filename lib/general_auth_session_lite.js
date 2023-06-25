//
const AppLifeCycle = require("./general_lifecyle")
const LocalSessionTokens = require("./default_session_token")



/**
 * Provides access to token storage, making the semantics of token processing available to 
 * the authorization classes.
 */
class TokenTables extends AppLifeCycle {

    constructor(db_obj,tokenStorage) {
        super()
        //
        this.db = db_obj
        // These are loosly written here. But, it may be good to keep 
        // a small number relative to session size id the backend is efficient
        try {
            this.tk_store = new tokenStorage(db_obj)
        } catch (e) {
            console.log(e)
        }
    }

    token_to_key(token) {
        let key = this.tk_store.from_token(token)
        return key
    }

    async addSession(key,session_token) {    // e.g. ucwid and server side hash
        if ( (key !== undefined) && (session_token !== undefined) ) {
            this.tk_store.add(session_token,key)    // ucwid, stashed token -> stashed token, ucwid
        }
    }

    destroySession(token) {
        this.tk_store.destroy_session(token)
    }

    // bool
    async tokenCurrent(token) {
        if ( token === undefined ) return(false)  
        let current = await this.tk_store.current_active(token,false,undefined)
        return ( current !== false )
    }

    async sessionCurrent(session_token,src_key) {           // src_key is not in use in the general case
        if ( src_key === undefined ) return(false)
        let key = await this.tk_store.current_active(session_token,true,src_key)  // src key might be a ucwid
        return key
    }

}



/**
 * Provides a subset of methods required for authorization and authorized transition processing.
 * Makes use of established sessions, transition tokens in order to set actual transition operations into action.
 */
class SessionManager_Lite extends TokenTables {

    //
    constructor(exp_app,db_obj,business,transition_engine,tokenStorage) {  // reference to the DB and initializes the a middleware vector
        super(db_obj,tokenStorage)
        this.app = exp_app          // not used generally,, but will be available to applications
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
        this.trans_engine = transition_engine
        //
        this.hashables = clonify(conf.forhash)
        //
        this.user_cookie = conf.user_cookie
        this.max_age_user_cookie = 90000
        this.require_secure_transfer = false
        if ( conf ) {
            if ( conf.use_secure_transfer ) {
                this.require_secure_transfer = true
            }
        }
    }

    extract_exposable_user_info(user,info) {
        return(user.name)
    }

    //
    async gen_wrapped_key(wrapper_public_key) {  // generate a wrapped aes key...
        return ""  // let descendants implement
    }

    async cipher(clear_text,aes_key) {
        return clear_text               // let descendants implement
    }

    //
    async guard(asset,body,req) {
        if ( this.require_secure_transfer ) {
            if ( req.protocol === "https" ) {
                return true
            }
            return false
        }
        return(true)    // true by default
    }

    async guard_static(asset,boyd,req) {
        return(true)
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

    sess_data_accessor() {  // likely to be overridden e.g. "_tracking"
        return "app_user_data"
    }
 

    // stash_session_token
    //              (user,transtion_object,sess_tok)
    // the stored transition object identified (mapped) by its token,
    // will have the session token within the elements map object.
    // see stash_session_token(user,transtion_object,sess_tok) in general_auth which extends this module
    // 
    unstash_session_token(transObject) {
        let key = this.sess_data_accessor()
        if ( key ) {
            return(transObject.elements[key])
        }
        return false
    }

    key_for_user() {    // override this for tracking the user across of few user transitions
        return('id')
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



    //   assets
    process_asset(asset_id,post_body) {
        let token = this.this.tk_store.create_token(asset_id)
        let transtion_object = {
            "token" : token,        // default behavior... implement
            "secondary_action" : false,
            "type" : "static_asset"
        }
        return(transtion_object)
    }
    

    //
    process_transition(transition,post_body,req) {  // req for any session cookies, etc.
        let token = this.this.tk_store.create_token(post_body._token_prefix)
        let transtion_object = {
            "token" : token,
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


    update_session_state(transition,post_body,req) {    // req for session cookies if any
        return true
    }

    set_cookie(res,cookie_id,value,age) {
        // application overried 
    }

    release_cookie(res,cookie_id) {}

    app_user_check_cookie(req,session_token) {/* application only */}

    handle_cookies(result,res,transitionObj) {/* application only */}

}


/** 
 * Provides an interface to the top level transition prrocesing and module initialization.
 * Takes in referneces to the database, web app handlers, the transition engine and optionally 
 * a custom token storage class.
 */
class GeneralAuth extends AppLifeCycle {

    constructor(sessClass,tokenStorageClass) {
        super()
        //
        this.db = null
        this.trans_engine = null
        this.sessionClass = sessClass ? sessClass : SessionManager_Lite
        this.tokenStorageClass = tokenStorageClass ? tokenStorageClass : LocalSessionTokens
    }

    sessions(exp_app,db_obj,bussiness,transition_engine) {
        let sess_m = new this.sessionClass(exp_app,db_obj,bussiness,transition_engine,this.tokenStorageClass);
        this.db = db_obj
        return(sess_m)
    }

}

module.exports = SessionManager_Lite
module.exports.SessionManager_Lite = SessionManager_Lite
module.exports.GeneralAuth = GeneralAuth