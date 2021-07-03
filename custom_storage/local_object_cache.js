

// keep basic transition information around between calls for certain flow processes.
// this is not shared with other system processes, so just use local data structures. 
// (this could be modularized with C++ or other..)


class LocalTObjectCache {
    //
    constructor(cache_time) {
        this.cache_map = {}
        this.max_cache_time = cache_time
    }

    //
    add_local_cache_transition(token,tobject) {
        if ( this.cache_map ) {
            this.cache_map[token] = tobject
            if (  tobject.tobj.session_token ) {
                delete tobject.tobj.session_token
            }
            if ( tobject.tobj && tobject.tobj.entry_time ) {
                tobject.entry_time = tobject.tobj.entry_time
            }
        }
    }

    //
    fetch_local_cache_transition(token,next) {
        if ( this.cache_map ) {
            let transObject = this.cache_map[token]
            if ( !(next) ) delete this.cache_map[token]
            return transObject
        }
        return undefined
    }

    // 
    timeout_transition_cache(cache_map) {
        if ( cache_map ) {
            let now_time = Date.now()
            let delete_these = []
            for ( let token in cache_map ) {
                let tobj = cache_map[token]
                if ( tobj.entry_time ) {
                    if ( (now_time - tobj.entry_time) > this.max_cache_time ) {
                        delete_these.push(token)
                    }
                }
            }
            for ( let token of delete_these ) {
                delete cache_map[token]
            }
        }
    }

}

                        
module.exports = LocalTObjectCache