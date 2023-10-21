//
const AppLifeCycle = require("./general_lifecyle")
const LocalSessionTokens = require("session_tokens").optimal   // session token management has been isolated
const { 
    TransitionObject, 
    LoginTransitionObject, 
    LogoutTransitionObject, 
    RegistrationTransitionObject, 
    ProcessTransitionObject
} = require("state-tokens")


const SessionTokenManager = require("./session_token_manager")

/**
 * Provides a subset of methods required for authorization and authorized transition processing.
 * Makes use of established sessions, transition tokens in order to set actual transition operations into action.
 * 
 * Not to forget that this is a client facing class. The purpose of this class is to provide the basic methods (abstractly in most cases)
 * for the management of authorization and allowing access to authorized processes. This class provide guards, matching, and calls out to 
 * backend (e.g. transitions engine) processes such as finalization of the state transition, queries as to the feasibility of
 * state transitions, and setting up transitions or providing access to assets, either static or computed (dynamic).
 * 
 * As this is client facing, access is provided to the middleware and the web application class instance.
 * 
 * This class has access to the business class (which may be useful in some applications) and to the transition engine.
 * Most applications will have some specialization of the transition engine. The transition engine will most likely be called upon
 * during transition finalization, but may be use to prepare for the transition as well.
 * 
 * For the most part, the class manages the lifecycle of a transition object. The associated transition token may be of use, but
 * the token is managed by the contractual classes utilized by the class CopiousTransitions found in `user_service_class.js`.
 * 
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

    /**
     * The transition type is passed in as a parameter to the 
     * transition object constructor.
     * 
     * The subtype parameter is used to identify the class of the constructor.
     * Take note that just a few types have their own classes. These are mostly for session management transitions.
     * 
     * The `true transition` subtype is for actual state machine or Petri net travel occuring in generalized transition engines.
     * All others are application specific with subtypes developed separately for each process.
     * 
     * @param {string} t_type 
     * @param {string} sub_type 
     * @returns 
     */
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

    /**
     * 
     * @param {object} user - a DB record representing a user
     * @param {object} info - application specific information that may be used with the user data to extract information.
     * @returns - returns some user information -- default is the name
     */
    extract_exposable_user_info(user,info) {
        return(user.name)
    }

    //
    /**
     * A method that returns a wrapped key after generating it.
     * This method is left as abstract. 
     * 
     * @param {object} wrapper_public_key  - a wrapper key
     * @returns {string} - an empty string by default - the application sould override this method.
     */
    async gen_wrapped_key(wrapper_public_key) {  // generate a wrapped aes key...
        return ""  // let descendants implement
    }

    /**
     * Override this method to use the application specific key format and run 
     * the cipher picked by the application. 
     * 
     * The method is left abstract. It does not place any condition on the kind of cipher nor the format in which the cipher is passed.
     * 
     * @param {string} clear_text 
     * @param {object} aes_key - an AES key (or other) in a format that may be consumed by descendant library users 
     * @returns 
     */
    async cipher(clear_text,aes_key) {
        return clear_text               // let descendants implement
    }

    //
    /**
     * This method intercepts requests that require processing, including dynamically generated assests and 
     * state transitions.
     * 
     * The guard method at a minimum will check to see if the CopiousTransitions innstance is checking for https
     * and provide the check if it is. 
     * 
     * There may be applications that provide a complex and calculated checks. But, in most cases, the checks wil be rapid
     * and sufficient for the request to be accepted or rejected in a timely manner for the client.
     * 
     * Some applications may want to provide use of an ACL subprocess at this point.
     * 
     * @param {string} asset - idenitifies the asset that is being accessed.
     * @param {object} body - This is the request object sent by the client
     * @param {object} req - This is request object derived from the HTTP header
     * @returns 
     */
    async guard(asset,body,req) {
        if ( this.require_secure_transfer ) {
            if ( req.protocol === "https" ) {
                return true
            }
            return false
        }
        return(true)    // true by default
    }



    /**
     * If a client request has access to a transition (state machine, Petri net), then one more kind of check will
     * be employed. In this case, the transition is checked for feasibility; that is, the transition request may be limited in
     * resoures it may use or it may not be supported computationally by the host machine.
     * 
     * Many types of applications may check feasibility in particular ways. For example, one application may check on rate limiting
     * for certain transitions. Another, might check a balance. A fairly general check might be that a requested state transition targets
     * an existing final state. One use already being used is to check if a signature can be verified with server side session data.
     * 
     * @param {string} transition 
     * @param {object} post_body - This is the request object sent by the client
     * @param {object} req - This is request object derived from the HTTP header 
     * @returns 
     */
    feasible(transition,post_body,req) {            // examine the session state to see if the transition can take place
        return(false)
    }



    /**
     * This guard, the static guard, is similar to the more general `guard` method. But, some implementations may be paired down
     * considerably knowing that the asset being accessed will be some static file. In particular, the file might have been preloaded.
     * Rate limiting might also be checked in the guard.
     * 
     * Usually, this method will access the static assets module to make queries about assets.
     * 
     * @param {*} asset 
     * @param {*} boyd 
     * @param {*} req 
     * @returns 
     */
    async guard_static(asset,boyd,req) {
        return(true)
    }

    /**
     * 
     * @param {*} udata 
     * @returns 
     */
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


    /**
     * This is a key that may be set by the application. Generic code will not know the name of a field in a DB
     * nor in objects received from the client. An application can override this method and let the generic methods operated with ti.
     * @returns {string} - a field name for accessing keys to user data
     */
    key_for_user() {    // override this for tracking the user across of few user transitions
        return('id')
    }

    //
    /**
     * The match method is employed during a secondary transition phase of a transition or in secondary user processing (access management).
     * 
     * The default case is for the client to post a body with a field `_t_match_field`. This field is compared to a `match` field stored 
     * in the elements sub-object of a chached transition object, one that has been created during the first phase of transition 
     * processing.
     * 
     * @param {object} post_body 
     * @param {object} transtion_object 
     * @returns 
     */
    match(post_body,transtion_object)  {
        if ( post_body._t_match_field ) {
            let t_match = transtion_object.elements.match;
            if ( t_match === post_body._t_match_field ) {
                return true
            }
        }
        return false
    }


    //   assets**
    /**
     * This method generates a transition object for tracking the access to a guarded asset of some time.
     * The transition object generated is not applied to a transition.
     * 
     * @param {*} asset_id 
     * @param {*} post_body 
     * @returns 
     */
    process_asset(asset_id,post_body) {
        let token = this.generate_transition_token(asset_id)
        let transition_object = this.create_transition_record('static_asset')
        transition_object.set_token(token)
        return(transition_object)
    }
    
    //
    /**
     * This method generates a transition object for a kind of transition. 
     * The transition object remains available for the duration fo the transition.
     * There are two types of transition processes, one, those which work with one request from the client
     * and two, those that work with more than one request from the client, one requiring secondary action. 
     * 
     * When an application wishes to use a secondary action, it must set the `secondary_action` in the transition object.
     * 
     * 
     * @param {*} transition 
     * @param {*} post_body 
     * @param {*} req 
     * @returns 
     */
    process_transition(transition,post_body,req) {  // req for any session cookies, etc.
        //
        let token = this.generate_transition_token(post_body._token_prefix)
        let transition_object = this.create_transition_record(transition,'true-transition')
        transition_object.set_token(token)
        return(transtion_object)
    }

    /**
     * Primary transitions that do not require seconday responses from the client and secondary transition processing may 
     * determine that a transition may be finalized. That is, a transition may be recorded as having completed allowing
     * for the process to settle into a new state.
     * 
     * This method returns an object that indicates the state of the machine. The entirety of this object will be passed on 
     * to the client.
     * 
     * @param {string} transition 
     * @param {object} post_body 
     * @param {object} elements 
     * @param {object} req 
     * @returns {object} data destined to the client and with a report as to the state of the machine relative to the client
     */
    finalize_transition(transition,post_body,elements,req)  {
        let finalization_state = {
            "state" : "UP",
            "OK" : "true"
        }    
        return(finalization_state)   // finalization state more likely some objecg
    }

    // --
    /**
     * Implementations of this method will keep track of errors accrued while processing a transition.
     * 
     * 
     * @param {*} category 
     * @param {*} data 
     * @param {*} err 
     */
    session_accrue_errors(category,data,err) {}

    /**
     * Often called by `finalize_transition`. This is an abstract placeholder for applications that choose to implement it. 
     * It is provided allow clients to set session variables and to figure a status to return from `finalize_transition`.
     * 
     * This method suggests a set of parameter to such an update call. But, it does not indicate a way that it should be called by 
     * `finalize_transition`.
     * 
     * @param {*} transition 
     * @param {*} post_body 
     * @param {*} req 
     * @returns 
     */
    update_session_state(transition,post_body,req) {    // req for session cookies if any
        return true
    }

    /**
     * These method allow for implementations to manage cookies when dealing with browsers
     * @param {*} res 
     * @param {*} cookie_id 
     * @param {*} value 
     * @param {*} age 
     */
    set_cookie(res,cookie_id,value,age) {
        // application overried 
    }

    /**
     * These method allow for implementations to manage cookies when dealing with browsers
     * @param {*} res 
     * @param {*} cookie_id 
     */
    release_cookie(res,cookie_id) {}

    /**
     * 
     * These method allow for implementations to manage cookies when dealing with browsers
     * @param {*} req 
     * @param {*} session_token 
     */
    app_user_check_cookie(req,session_token) {/* application only */}

    /**
     * 
     * These method allow for implementations to manage cookies when dealing with browsers
     * @param {*} result 
     * @param {*} res 
     * @param {*} transitionObj 
     */
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