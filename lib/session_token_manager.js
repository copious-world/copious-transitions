//
const AppLifeCycle = require("./general_lifecyle")



/// TokenTables

/**
 * Top level abstraction defining the relationship between token users, and token storage which may refer to some DB.
 * 
 * Provides access to token storage, making the semantics of token processing available to 
 * the authorization classes.
 * 
 * This abstraction just fixes a handle to some DB interface and provides methods that wrap the token storage,
 * which must be provided to the constructor.
 * 
 * @memberof base
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

    /**
     * 
     * @param {string} prefix 
     * @returns {string} -  a token for a transition object
     */
    generate_transition_token(prefix) {
        return (this.tk_store.create_token(prefix))
    }

    /**
     * 
     * @param {string} token 
     * @returns {any|Promise}
     */
    token_to_key(token) {
        let key = this.tk_store.from_token(token)
        return key
    }


    /**
     * 
     * @param {string} token 
     * @returns {boolean}
     */
    async tokenCurrent(token) {
        if ( token === undefined ) return(false)  
        let current = await this.tk_store.transition_token_is_active(token)
        return ( current !== false )
    }

}


/// SessionTokenManager

/**
 * 
 * The Session Token Manager deals JSON objects arriving from some session oriented client. 
 * The JSON object is interned and stored as in the language's data object format. 
 * Certain fields may be expected in the data object. Methods for some default case are provided, but
 * it is expected the application will override these methods and provide access for fields germain to the application.
 * 
 * Provides basic methods for generating session tokens, stashing and unstashing.
 * 
 * Manages a reference to a hashing method, called by `do_hash`. 
 * 
 * @extends TokenTables
 */

class SessionTokenManager extends TokenTables {
    //
    /**
     * 
     * The configuration may bind the field `forhash` to a hashing function that will be used throughout the runtime.
     * 
     * The db_obj is a reference to a class instance that knows how to talk to a database.
     * 
     * The tokenStorage parameter is a required class reference that can generate a instance that manages tables of tokens.
     * 
     * Initializes a table `release_session_data` for keeping data between client repsonses, where data comes from user objects,
     * most likely obtained from the DB. In particular, the data will have a named field provided by `sess_data_accessor`. The data
     * lasts until the user session is initialized by an authorization process, one that uses the general authorization (as opposed to 
     * light authorizatoin).
     * 
     * @param {object} conf 
     * @param {object} db_obj 
     * @param {Class} tokenStorage 
     */
    constructor(conf,db_obj,tokenStorage) {
        //
        super(db_obj,tokenStorage)    // token tables
        //
        this._sess_tok_hasher = (typeof conf.session_token_hasher === 'function') ? conf.session_token_hasher : this.#produce_hasher()
        //
        if ( conf ) {
            this.hashables = clonify(conf.forhash)   // clone the field map from the configuration.
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
     * Access to a default hash function set globally for the application
     */
    #produce_hasher() {
        try {
            if ( global_hash === undefined ) {

            } else {
                this._sess_tok_hasher = global_hash
            }
        } catch (e) {
        }
    }

    /**
     * Synonimic method to expose the hash function field, a configurable parameter
     * 
     * @param {string} str 
     * @returns {string} - the hash of the string 
     */
    do_hash(str) { // default behavior -- 
        return(this._sess_tok_hasher(str))
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





module.exports = SessionTokenManager