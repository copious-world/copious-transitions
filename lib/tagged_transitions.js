
class TaggedTransition {
    //
    constructor(in_tag) {
        this.tag = in_tag
        this.worker_queue = []
        this.cases = []
    }

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

    action_selector(action) {
        return(false)
    }

    transform_file_name(file_name) {
        return(file_name)
    }

    file_entry_id(file_key) {
        return("_" + file_key + "_" + Date.now())
    }

    dir() {
        return(__dirname)
    }
    //
}

module.exports = TaggedTransition