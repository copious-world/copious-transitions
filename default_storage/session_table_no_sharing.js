
/**
 * 
 * Strictly an LRU in memory, no communication, no backup to files, t
 * 
 */

const DEFAUL_CROWD_ALLOWANCE = 50

/**
 * KeyValueDBDefault
 *
 */
class SessionKeyValueDBDefault {

    constructor() {        // eg. message_relay_client
        //
        this.table = new Map()
        this.lru = []
        //
    }

    async initialize(conf) {
        this.conf = conf
        this.session_time = parseInt(conf.max_session_stay)
        this.crowd_allowance = conf.crowd_size_allowance ? parseInt(conf.crowd_size_allowance) : DEFAUL_CROWD_ALLOWANCE
        //
        if ( this.conf.check_mem_interval ) {
            let memcheck_interval_time = parseInt(this.conf.check_mem_interval)
            let self = this
            this.memcheck_interval = setInterval(async () => {
                await self.timed_cull()
            },memcheck_interval_time)
        }
        //
    }


    async add_connection(conf) {}
    async close_connection(conf) {}

    // specifically do not implement setPersistence
    // setPersistence(pdb) {
    //     this.pdb = pdb
    // }

    /**
     * 
     * set
     * 
     * @param {string} key 
     * @param {object} value 
     */
    set(key,value) {
        this.table.set(key,{ "time" : Date.now(), "value"  : value })
        this.lru.push(key)
    }

    /**
     * If  not in the local table, try the cached storage.
     * 
     * 
     * @param {string} key 
     * @returns 
     */
    async get(key) {
        let maybe_in_table = this.table.has(key)
        if ( maybe_in_table ) {
            return this.table.get(key)
        }
        return null
    }


    /**
     * delete
     * 
     * Delete the key from the local.
     * Then passes onto a batch removal
     * 
     * @param {string} key 
     */
    delete(key) {
        if ( this.table.has(key) ) {
            let data = this.table.get(key)
            if ( data ) {
                this.table.delete(key)
                let i = this.lru.indexOf(key)
                if ( i >= 0 ) {
                    this.lru.splice(i,1)
                }
            }
        }
    }

    /**
     * 
     * @param {string} key 
     * @returns {boolean} true if the key is stored
     */
    async exists(key) {
        let maybe_in_table = this.table.has(key)
        return maybe_in_table
    }


    /**
     * timed_cull
     */
    async timed_cull() {
        let ref_time = Date.now()
        let largest_index = 0
        //
        for ( let i = 0; i < this.lru.length; i++ ) {
            let key = this.lru[i]
            if ( this.table.has(key) ) {
                let value = this.table.get(key)
                let dtime = value.time
                if ( (ref_time - dtime) > this.session_time ) {
                    largest_index = i
                }
            }
        }
        //
        let crowd_size_allowance = (this.lru.length - this.crowd_allowance)

        let delete_limit = Math.max(crowd_size_allowance,5)
        let del_index = Math.min(largest_index,delete_limit)

        this.lru.splice(0,del_index)
        //
    }



    /**
     * shutdown
     */

    async shutdown() {
        if ( this.memcheck_interval ) {
            clearInterval(this.memcheck_interval)
        }
        if ( this.removal_interval ) {
            clearInterval(this.removal_interval)
        }
        await this.persistence_store_and_cull(true)
    }

}



module.exports = SessionKeyValueDBDefault