const {FileOperationsCache} = require('extra-file-class')

/**
 * 
 * 
 * 1) The key value DB is an LRU in memory cache which has disk backup. Different kinds of data structures can be put there.
 *      -- If a value is out of cache, it can be retrieved from disk. Used in song-search db. Stores files as the value.
 *      -- Also, it retrieves files from disk at startup and stores them into the in-memory table. (A shim for something like 
 *      -- Redis might be used instead.)
 * 
 */


/**
 * KeyValueDBDefault
 *
 */
class KeyValueDBDefault {

    constructor() {        // eg. message_relay_client
        //
        this.table = new Map()
        this.keys_to_remove = []
        //
        this.removal_interval = false
        this.memcheck_interval = false
        //
        this.fosc = false
    }

    async initialize(conf) {
        this.conf = conf
        if ( conf.file_cache !== undefined ) {
            this.fosc = new FileOperationsCache(conf.file_cache)
        } else {
            return false
        }
        if ( conf.disk_storage !== undefined ) {
            await this.load_all_records()
        } else {
            return false
        }
        //
        if ( conf.check_mem_interval ) {
            if ( this.check_mem_interval ) {
                clearInterval(this.check_mem_interval)
                this.check_mem_interval = null
            }
            let memcheck_interval_time = parseInt(this.conf.check_mem_interval)
            let self = this
            this.memcheck_interval = setInterval(async () => {
                await self.persistence_store_and_cull(false)
            },memcheck_interval_time)
        }
        //
        if ( conf.removal_interval ) {
            if ( this.removal_interval ) {
                clearInterval(this.removal_interval)
                this.removal_interval = null
            }
            let removal_interval_time = parseInt(this.conf.removal_interval)
            let self = this
            this.removal_interval = setInterval(async () => {
                await self.remove_when()
            },removal_interval_time)
        }
        //
    }



    async add_connection(conf) {
        //
        await this.close_connection(conf)
        await this.initialize(conf)
    }

    async close_connection(conf) {
        //
        if ( this.check_mem_interval ) {
            clearInterval(this.check_mem_interval)
            this.check_mem_interval = null
        }
        if ( this.removal_interval ) {
            clearInterval(this.removal_interval)
            this.removal_interval = null
        }
        //
        if ( this.fosc ) {
            await this.fosc.synch_files()
            await this.fosc.stop_sync()    
        }
        //
    }


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
        this.table.set(key,value)
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
        } else {
            let can_find = await this.exists(key)
            if ( can_find ) {
                let maybe_in_table = this.table.has(key)
                if ( maybe_in_table ) {
                    return this.table.get(key)
                }    
            }
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
        this.table.delete(key)
        this.plan_removal(key)
    }

    /**
     * 
     * @param {string} key 
     * @returns {boolean} true if the key is stored
     */
    async exists(key) {
        let maybe_in_table = this.table.has(key)
        if ( !maybe_in_table ) {
            if ( this.keys_to_remove.indexOf(key) < 0 ) {
                //
                let map_file_key = key.substring(0,8) // get a file that stores all the keys of similarly named human
                let storage = await this.load_data_category(map_file_key)
                if ( storage ) {
                    if ( key in storage ) {
                        maybe_in_table = true;
                    }
                }
                //
            }
        }
        return maybe_in_table
    }


    /**
     * persistence_store_and_cull
     */
    async persistence_store_and_cull(all) {
        let selected_stores = {}
        let n = this.table.size
        if ( (n > this.conf.max_in_mem)|| all ) {
            let send_count = all ? n : this.conf.release_size
            let ks = [...this.table.keys()]
            let msg = {}
            msg.data = []
            for ( let i = 0; i < send_count; i++ ) {
                let k = all ? i : this.get_random_index((send_count - i))
                let ky = ks[k]
                let value = this.table.get(ky)
                if ( !(all) ) ks.splice(k,1)
                this.table.delete(ky)
                let map_file_key = ky.substring(0,8) // get a file that stores all the keys of similarly named human
                let storage = selected_stores[map_file_key]
                if ( storage == undefined ) {
                    storage = await this.load_data_category(map_file_key)
                    selected_stores[map_file_key] = storage
                }
                storage[ky] = value
            }
            await this.write_data_categories(selected_stores)
        }
    }


    /**
     * load_data_category
     * 
     * @param {*} key 
     * @returns 
     */
    async load_data_category(map_file_key) {
        if ( this.fosc ) {
            let key_map = await this.fosc.load_json_data_at_path(`${this.conf.disk_storage}/${map_file_key}.json`)  // list of keys
            if ( !key_map && (map_file_key !== undefined) ) {  // the file does not exist yet
                key_map = {}
                await this.fosc.output_json(`${this.conf.disk_storage}/${map_file_key}.json`,{})
            }    
        }
        return key_map
    }

    /**
     * write_data_categories
     * 
     * selected_stores is a map of maps where each key a prefix shared by members of the map indexed by the prefix.
     * 
     * @param {Object} selected_stores 
     */
    async write_data_categories(selected_stores) {
        if ( this.fosc ) {
            for ( let map_file_key in selected_stores ) {
                await this.fosc.output_json(`${this.conf.disk_storage}/${map_file_key}.json`,selected_stores[map_file_key])
            }
        }
    }


    /**
     * load_all_records
     * 
     * For initialization
     */
    async load_all_records() {
        if ( this.fosc ) {
            let record_list = await this.fosc.dir_reader(this.conf.disk_storage)
            record_list = record_list.filter((file) => {
                return ( file.lastIndexOf('.json') > 0 )
            })
            for ( let recordfile of record_list ) {
                await this.fosc.load_json_data_at_path(`${this.conf.disk_storage}/${recordfile}`)
            }
        }
    }



    /**
     * check_existence
     * 
     * @param {string} key 
     * @returns string | boolean = false --
     */
    async check_existence(key) {
        //
        if ( this.fosc === false ) throw "Did not configure the server properly: need config for cached verion of extra-file-class"
        //
        //
        let status = false
        let map_file_key = key.substring(0,8) // get a file that stores all the keys of similarly named humans
        //
        //
        let key_map = await this.fosc.load_json_data_at_path(`${this.conf.disk_storage}/${map_file_key}.json`)  // list of keys 
        //
        if ( !key_map && (key !== undefined) ) {  // the file does not exist yet
            return status
        } else {
            if ( key in key_map ) {
                status = true
            }
        }
        //
        return status;
    }


    /**
     * 
     * @param {string} key 
     * @returns 
     */
    async remove_existence(key) {
        if ( this.fosc ) {
            let map_file_key = key.substring(0,8) // get a file that stores all the keys of similarly named humans
            let key_map = await this.fosc.load_json_data_at_path(`${this.conf.disk_storage}/${map_file_key}.json`)  // list of ccwids
            if ( key_map == false ) {
                return
            }
            if ( key in key_map ) {
                delete key_map[key]
                await this.fosc.output_json(`${this.conf.disk_storage}/${map_file_key}.json`,key_map)
            }
        }
    }


    /**
     * plan_removal
     * @param {string} key 
     */
    plan_removal(key) {
        this.keys_to_remove.push(key)
    }

    /**
     * remove_when
     */
    async remove_when() {
        while ( this.keys_to_remove.length > 0 ) {
            let key = this.keys_to_remove.shift()
            await this.remove_existence(key)
        }
    }

    /**
     * 
     * @param {number} limit 
     * @returns 
     */
    get_random_index(limit) {
        let rindex = Math.random()*limit
        let index = Math.floor(rindex)
        return index
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
            await this.remove_when()
        }
        await this.persistence_store_and_cull(true)
    }

}



module.exports = KeyValueDBDefault