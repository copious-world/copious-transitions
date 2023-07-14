



/** 
 * The objects that represent transitions are tagged transition..
 * These are used for global defintions of particular transition type.
 * Applications that implement custom descendant methods of the general modules 
 * may branch on typs of transitions by querying the *tagged* method of the transition object.
 * 
 * The global definition is useful in short micro service modules. However, the aim is a generalization 
 * which will be further developed.
 * 
 * Specific data reference fields will be provided via the transition object.
 * A worker queue is part of every tagged transition. Transition engines may access the worker queue.
 */

class TaggedTransition {
    //
    constructor(in_tag) {
        this.tag = in_tag
        this.worker_queue = []
        this.cases = []
    }

    initialize(conf) {}

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

    tag() {
        return this.tag
    }

    addModule(module) {
        this.cases.push(module)
    }

    enqueue(data) {
        this.worker_queue.push(data)
    }

    empty_queue() {
        return( this.worker_queue.length === 0)
    }

    get_work() {
        let work = this.worker_queue.shift()
        return(work)
    }

    update(data) {
        return(data)
    }

    existence_query(udata) {
        return(udata)
    }

    has_secondary_action(asset_type) {
        return(true)
    }

    from_cache() {
        return(false)
    }

    primary_key() {
        return("ID")
    }

    back_ref() {
        return('_back_ref_field')  // if anything is being stored, assume some data field (most likely not implemented)
    }

    kv_store_key() {
        return("kvid")
    }

    match_key() {
        return('match')
    }

    session_key() {
        return("token")
    }

    uuid_prefix() {
        return('nonce+')
    }

    hash_id_prefix() {
        return('nonce+')
    }

    action_selector(action) {
        return(false)
    }

    transform_file_name(file_name) {
        return(file_name)
    }

    file_entry_id(file_key) {
        return("_" + file_key + "_" + Date.now())
    }

    update_file_db_entry(entry_obj) {}

    dir() {
        return(__dirname)
    }
    //
}

module.exports = TaggedTransition