//
const AppLifeCycle = require("./general_lifecyle")
const LocalSessionTokens = require("session_tokens").optimal
const { 
    TransitionObject, 
    LoginTransitionObject, 
    LogoutTransitionObject, 
    RegistrationTransitionObject, 
    ProcessTransitionObject
} = require("state-tokens")



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

    //
    generate_transition_token(prefix) {
        return (this.tk_store.create_token(prefix))
    }

    //
    token_to_key(token) {
        let key = this.tk_store.from_token(token)
        return key
    }


    // bool
    async tokenCurrent(token) {
        if ( token === undefined ) return(false)  
        let current = await this.tk_store.transition_token_is_active(token)
        return ( current !== false )
    }

}


/**
 * Provides basic methods for generating session tokens, stashing and unstashing
 * @extends TokenTables
 */

class SessionTokenManager extends TokenTables {
    //
    constructor(conf,db_obj,tokenStorage) {
        super(db_obj,tokenStorage)
        //
        if ( conf ) {
            this.hashables = clonify(conf.forhash)   // global clone method
        } else {
            this.hashables = { "field1" : "ucwid", "field2" : "timestamp" }   // if these were not configured use something failry arbitrary
        }
        //
        this.release_session_data = {}  // if a session provides information for release on finalization, temporarily keep it here
    }

    /**
     * Return the field name of the user object that references data that should be accessed as part of the session
     */
    sess_data_accessor() {  // likely to be overridden e.g. "_tracking"
        return "app_user_data"
    }


    /**
     * Access to a default has function set globally for the application
     */
    do_hash(str) { // default behavior -- 
        return(global_hash(str))
    }

    /**
     * Makes a session token and returns it as a string
     * 
     * >Uses access to a default hash function set globally for the application
     * 
     * This method concatentates two informational parts and one nonce to make a parameter to a hash function
     * in order to get a key that may be used as the session identifier.
     * 
     * @param {object} post_body  -- this is the JSON post body from the web application 
     */
    generate_session_token(post_body) {
        let nonce = this.generate_transition_token();
        //
        let hash_part_1 = post_body[this.hashables.field1]   // the field might no be supplied by the application
        hash_part_1 = hash_part_1 ? hash_part_1 : "nothing1"
        let hash_part_2 = post_body[this.hashables.field3]   // the field might no be supplied by the application
        hash_part_2 = hash_part_2 ? hash_part_2 : "nothing2"
        //
        let sess_tok = this.do_hash(hash_part_1 + hash_part_2 + nonce) // this is the session identifier just getting started.
        return sess_tok
    }

    // 
    // stash_session_token

    /**
     * Stashes a session in the 'elements' map of the server-side transition object
     * 
     * @param {object} user  -- The user object is most likely extracted from the DB
     * @param {object} transtion_object -- a nascent transition object that has both server side and client side aspects, but must contain the newly generated session token
     */
    stash_session_token(user,transtion_object) {  // sess_tok a made up token (app rule)
        let sess_tok = transtion_object.session_token
        let app_sess_data_access_fld = this.sess_data_accessor()  // get the application identified field name that should occur in a user object
        if ( app_sess_data_access_fld ) {
            this.release_session_data[sess_tok] = user[app_sess_data_access_fld]  // app overrides so that it knows this field (ucwid)
            // The elements field will provide access to the session token (in turn to the user data) for the life the authorization transition
            transtion_object.elements[app_sess_data_access_fld] = sess_tok  // for secondary
        }  
    }


    // the stored transition object identified (mapped) by its token,
    // will have the session token within the elements map object.
    // see stash_session_token(user,transtion_object,sess_tok) in general_auth which extends this module
    // 
    /**
     * given the server side transition object for an authorization transition retrieve the sesssion token
     * from the transition object's elements fields
     */
    unstash_session_token(transObject) {
        let key = this.sess_data_accessor()
        if ( key ) {
            return(transObject.elements[key])
        }
        return false
    }

    /**
    * Calls upon token storage to save the session and the relationship to its owner.
    * 
    * @param {string} key -- a key, mostly likely a ucwid that identifies an owner of the session
    * @param {string} session_token --  a session token (should be made by generate_session_token)
    */
    async addSession(key,session_token) {    // e.g. ucwid and server side hash
        if ( (key !== undefined) && (session_token !== undefined) ) {
            this.tk_store.add_session(session_token,key)    // ucwid, stashed token -> stashed token, ucwid
        }
    }

    /**
    * Calls upon token storage to termiate a session and the tokens that expire with its termination.
    * The parameter passed is the session's transition token, which had been created for authorization transitions.
    * The parameter is used to obtain the session token.
    * 
    * @param {string} token -- the session's authorization transition token.
    */
    destroySession(token) {
        this.tk_store.destroy_session(token)
    }
    
    /**
    * Checks to see if a session is current.
    * The source key may be supplied to check on the hash of owner related data.
    * 
    * @param {string} session_token --  a session token (should be made by generate_session_token)
    * @param {string} [src_key] -- data returned from storing the transition token
    */
    async sessionCurrent(session_token,src_key) {           // src_key is not in use in the general case
        if ( src_key === undefined ) return(false)
        let key = await this.tk_store.active_session(session_token,src_key)  // src key might be a ucwid
        return key
    }

}



/**
 * Provides a subset of methods required for authorization and authorized transition processing.
 * Makes use of established sessions, transition tokens in order to set actual transition operations into action.
 */
class SessionManager_Lite extends SessionTokenManager {

    //
    constructor(exp_app,db_obj,business,transition_engine,tokenStorage) {  // reference to the DB and initializes the a middleware vector
        
        let conf = exp_app._extract_conf()

        super(conf,db_obj,tokenStorage)

        //
        this.app = exp_app          // not used generally,, but will be available to applications
        this.middle_ware = null
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
        this.user_cookie = conf.user_cookie
        this.max_age_user_cookie = 90000
        this.require_secure_transfer = false
        //
        if ( conf ) {
            if ( conf.use_secure_transfer ) {
                this.require_secure_transfer = true
            }
        }
    }

    create_transition_record(t_type,sub_type) {
        let tor = false
        if ( sub_type ) {
            switch ( sub_type ) {
                case 'login' : {
                    tor = new LoginTransitionObject(t_type)
                    break
                }
                case 'logout' : {
                    tor = new LogoutTransitionObject(t_type)
                    break                    
                }
                case 'register' : {
                    tor = new RegistrationTransitionObject(t_type)
                    break;
                }
                case 'true-transition': {
                    tor = new ProcessTransitionObject(t_type)
                    break;
                }
                default : {
                    tor = new TransitionObject(t_type)
                }
            }
        } else {
            tor = new TransitionObject(t_type)
        }
        return tor
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
        let token = this.generate_transition_token(asset_id)
        let transition_object = this.create_transition_record('static_asset')
        transition_object.set_token(token)
        return(transition_object)
    }
    
    //
    process_transition(transition,post_body,req) {  // req for any session cookies, etc.
        //
        let token = this.generate_transition_token(post_body._token_prefix)
        let transition_object = this.create_transition_record(transition,'true-transition')
        transition_object.set_token(token)
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
        if ( tokenStorageClass !== undefined ) {
            if ( (typeof tokenStorageClass.token_maker) === 'function' ) {
                _l_token_maker = token_maker
            }
        }
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