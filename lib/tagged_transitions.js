
/** 
 * The objects that represent transitions are tagged transition..
 * These are used for global defintions of particular transition type.
 * 
 * The global definitions are useful in short micro service modules. However, the aim is a generalization 
 * which will be further developed. One aspect of the generalization will be that some application modules
 * will not use the global variable tagged transitions, but operations will be selected out of session keyed
 * data objects such as state machines. Or, a way of looking at it, might be that one type of tagged transition
 * will operate a number of state transitions where the data structure will track unamed transitions.
 * 
 * Applications that implement custom descendant methods of the general modules 
 * may branch on types of transitions by querying the *tagged* method of the transition object.
 * 
 * Specific data reference fields will be provided via the transition object.
 * A worker queue is part of every tagged transition. Transition engines may access the worker queue.
 * 
 * Another feature of the tagged transition is the use of modules. The array of cases can be have module keys.
 * If a module is used, a transition will be identified if the request asks for the transition type in conjunction with 
 * the module.
 * 
 * Most of the methods provided are normalizers for fields that go into queries or that set data aside, etc.
 * 
 * @memberof base
 */

class TaggedTransition {
    //
    constructor(in_tag) {
        this.tag = in_tag
        this.worker_queue = []
        this.cases = []
    }

    initialize(conf) {}

    /**
     * seeking_endpoint_paths  
     * 
     * Included for special cases
     * @returns Array
     */
    seeking_endpoint_paths() {
        return []
    }

    /**
     * set_messenger
     * 
     * @param {string} path 
     * @param {object} messenger -- communication object
     */
    set_messenger(path,messenger) {
    }

    
    /**
     * This check if a transition object has a particular tag. 
     * 
     * This is useful in application code for branching on the requester's transition. 
     * 
     * For instance, code might have a global variable, g_user_check. Then, code can check if operations relating to the user
     * check might be used:
     * ```
     * if ( g_user_check.tagged(transition) ) {
     *  // do things for this type of transition
     * } else if ( .... )  // do things for another type of transition
     * ```
     * Code that is more general might check in other ways.  E.g `let tagged_op = transition_map[transition]; tagged_op(req_body)`
     * 
     * Some of the short applications already written use global variable custom transitions.
     * 
     * If a module is used, a transition will be identified if the request asks for the transition type in conjunction with 
     * the module.
     * 
     * @param {string} tag 
     * @param {string} module 
     * @returns {boolean}
     */
    tagged(tag,module) {
        let cases = (this.tag === tag)
        if ( module !== undefined ) {
            if ( this.cases.length ) {
                let handled = (this.cases.indexOf(module) >= 0)
                cases = (cases && handled)
            }
        }
        return(cases)
    }

    /**
     * The string representing the tag type. The string returned is part of the requesting client vocabulary of transitions with repsect to the application.
     * @returns {string}  - the tag of this transition type
     */
    tag() {
        return this.tag
    }

    /**
     * Modules may be added. 
     * 
     * @param {string} module 
     */
    addModule(module) {
        this.cases.push(module)
    }

    /**
     * A number of transition types may enqueue work to be done after a request has returned or between rewuests, etc.
     * The transtion context marker (the global variable in the basic case) can call up work in different contexts 
     * and do the work when the context is encountered. Or, the context may be on a separate thread. 
     * 
     * This method enqueues a data object that 
     * 
     * 
     * @param {object} data 
     */
    enqueue(data) {
        this.worker_queue.push(data)
    }

    /**
     * Check to see if the work queue is empty or not.
     * 
     * @returns {boolean} - true if empty
     */
    empty_queue() {
        return( this.worker_queue.length === 0)
    }
    
    /**
     * Pull a work descriptor off the worker queue.
     * 
     * @returns {object}
     */
    get_work() {
        let work = this.worker_queue.shift()
        return(work)
    }

    /**
     * This method is set asside for applications to make small changes to body data for special cases.
     * For instance, sometimes the ID coming in from the client won't be in a field recognizable by the rest of the system.
     * 
     * @param {object} data 
     * @returns {object}
     */
    update(data) {
        return(data)
    }

    /**
     * This method is made to produce an object that will be used as the query to a database 
     * to check for the existence of a user.
     * 
     * @param {object} udata 
     * @returns {object}
     */
    existence_query(udata) {
        return(udata)
    }

    /**
     * Returns true if the kind of mime type requested requires a seondary action 
     * in order to finalize delivery to the client.
     * 
     * 
     * @param {string} asset_type 
     * @returns {boolean}
     */
    has_secondary_action(asset_type) {
        return(true)
    }

    /**
     * Returns true if the type of transition takes information from cache DB rather than other DB.
     * 
     * @returns {boolean}
     */
    from_cache() {
        return(false)
    }

    /**
     * Returns the key that is used in identifying an object for a DB query.
     * Different types of transitions may have different key fields.
     * 
     * @returns {string}
     */
    primary_key() {
        return("ID")
    }

    /**
     * the appliation's name of the field use to search previous/parent relationships belonging to data objects
     * @returns {string}
     */
    back_ref() {
        return('_back_ref_field')  // if anything is being stored, assume some data field (most likely not implemented)
    }

    /**
     * Each type of transition may use a specific field in order to query the DB for an object.
     * 
     * @returns {string}
     */
    kv_store_key() {
        return("kvid")
    }

    /**
     * This is a field in a data object that is used to perform a match test, often in the match method of the session manager.
     * @returns {string}
     */
    match_key() {
        return('match')
    }

    /**
     * This is a key found in a request body and is used to determine that a session is going for a particular user.
     * 
     * @returns {string}
     */
    session_key() {
        return("token")
    }

    /**
     * An application and transition specific prefix for a uuid's that may be used to identify objects.
     * @returns {string}
     */
    uuid_prefix() {
        return('nonce+')
    }

    /**
     * An application and transition specific prefix for a more general hash that may be used to identify objects.
     * @returns {string}
     */
    hash_id_prefix() {
        return('nonce+')
    }

    /**
     * Some transition types may govern a set of actions which can be requested seperately during a transition action.
     * @param {string} action 
     * @returns {boolean|string}  - will be a governing string if the action is supported, false otherwise
     */
    action_selector(action) {
        return(false)
    }

    /**
     * This method allows for less special code to call on the application's version of file naming 
     * during certain transition actions.
     * 
     * @param {string} file_name 
     * @returns {string}
     */
    transform_file_name(file_name) {
        return(file_name)
    }

    /**
     * This method lets applications use a particular kind of name for certain kinds of files
     * and allow for the file name to be individualized for different files (no overwrite)
     * by changing the name or appending a suffix, such as the date.
     * 
     * @param {string} file_key 
     * @returns {string}
     */
    file_entry_id(file_key) {
        return("_" + file_key + "_" + Date.now())
    }

    /**
     * Provides a way to prepare the object representing the file entry in a database prior to 
     * moving the file from some default place (determined by a framework) to an application 
     * specific place.
     * 
     * @param {object} entry_obj 
     */
    update_file_db_entry(entry_obj) {}

    /**
     * In node.js this defaults to the directory the script is running from. 
     * But, this method can be overridden by applications to fix a particular directory
     * @returns {string}
     */
    dir() {
        return(__dirname)
    }
    //
}

module.exports = TaggedTransition