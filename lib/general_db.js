const AppLifeCycle = require("./general_lifecyle")
const crypto = require('crypto')

const DEFAULT_STATIC_SYNC_INTERVAL = (1000*60*30)


function default_hasher(key) {
    const hash = crypto.createHash('sha256');
    hash.update(key);
    let ehash = hash.digest('hex');
    return ehash
}


// the idea of the different types of DBs
// 1) The key value DB is an LRU in memory cache which has disk backup. Different kinds of data structures can be put there
//      -- if a value is out of cache, it can be retrieved from disk. Used in song-search db. Stores files as the value.
//      -- Also, it retrieves files from disk at startup and stores them into the in memory table. (A shim for something like 
//      -- Redis might be used.)
// 2) The session_key_value_db -- this is for taking in and validating sessions in particular. It might be useful for other 
//      -- data collection purposes. This is in-memory records, specifically within an LRU. There is no disk backup. But,
//      -- there is redundancy on secondary machines which will hold sessions for longer periods of time and age them out
//      -- gracefully unless they are accessed.
// 3) the pdb - a persistence database is a database that promises to maintain a record with some permanence. It is fronted by 
//      -- a key value db with ephemeral properties. But, it can be assumed that the records will be written early in the life of 
//      -- a data object. Aging out of the LRU quickly can be expected. And, the data location can be expected to be on a seconday 
//      -- machine. (User records -- for customer stats, etc. may be stored here)
// 4) the sdb - a static data base. The static db is expected to be fairly similar to a persistence DB, except that it offers the 
//      -- guarantee that the data items are stored on a disk local to the process which accesses the code. (This is mostly used to 
//      -- create a set of static assets for serving to web sessions. Ideally, the sort of caching available to nginx or other
//      -- web servers might be served by this sort of store.) It is expected that the store will be loaded when the database service 
//      -- starts for the general case. (The general case handles as much logic a it can. Dashboard and profile assets can be loaded. 
//      -- these are sitewide pages or page frameworks which might be loaded with user specific data.)
//

class GeneralDBWrapperImpl extends AppLifeCycle {
    //
    constructor(keyValueDB,sessionKeyValueDB,persistentDB,staticDB) {
        //
        super()
        //
        this.hasher = default_hasher
        //
        // EPHEMERAL (in memory will be erased when the application turns off.. BUT -- may be replicated on nodes with checkpoint writes)
        this.key_value_db = keyValueDB      // MEMORY BASED (SHARED MEM) but with with likely backup (size less determined)
        this.session_key_value_db = !(sessionKeyValueDB) ? keyValueDB : sessionKeyValueDB // MEMORY BASED (SHARED MEM) size fixed (all back up is elastic and ephemeral)
        //
        // CACHEABLE (WILL WRITE TO DISK SOMEWHERE)
        if ( !(persistentDB) ) {    // DISK within LOCAL and PEER NODES
            this.pdb = require('./default_persistent_db')
        } else {
            this.pdb = persistentDB
        }
        //
        if ( !(staticDB) ) {        // LOCAL ON DISK (LOCAL CACHE AND STARTUP CACHE)
            this.sdb = require('./default_persistent_db')
        } else {
            this.sdb = staticDB
        }
        if ( this.sdb && (typeof this.sdb.setPersistence === 'function ') ) {
            this.sdb.setPersistence(this.pdb)
        }
        if ( this.key_value_db && (typeof this.key_value_db.setPersistence === 'function ') ) {
            this.key_value_db.setPersistence(this.pdb)
        }
    }

    // configuration for persistent DB...
    initialize(conf) {
        this.key_value_db.initialize(conf)
        if ( this.session_key_value_db !== this.key_value_db ) {
            this.session_key_value_db.initialize(conf)
        }
        this.pdb.initialize(conf)           // initialize persitence...relative to the database
        this.sdb.initialize(conf)
        this.static_sync_interval = conf.static_sync ? conf.static_sync : DEFAULT_STATIC_SYNC_INTERVAL
    }

    set_hasher(hashfn) {
        this.hasher = hashfn
    }

    //  KEY VALUE cache like DB in memory.  e.g. an interface to shm-lru-cache 
    async set_key_value(key,value) {
        await this.key_value_db.set(key,value)
    }

    //
    async del_key_value(token) {
        await this.key_value_db.delete(token)
    }

    //
    async get_key_value(key) {
        try {
            let value = await this.key_value_db.get(key)
            return value    
        } catch (e) {
            console.log(e)
            return null
        }
    }


    // --- SESSION --- 
    async set_session_key_value(key,value) {
        return await this.session_key_value_db.hash_set(key,value)
    }

    //
    async del_session_key_value(key) {
        await this.session_key_value_db.delete(key)
    }

    //
    async get_session_key_value(key) {
        try {
            let value = await this.session_key_value_db.get(key)
            return value    
        } catch (e) {
            console.log(e)
            return null
        }  
    }

    
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    //
    async fetch_fields(fields_key) {
        // 
        let fields = {}
        if ( fields_key ) {
            let fields = await this.fetch(fields_key)
            if ( (typeof fields) === 'string' ) {
                fields = JSON.parse(fields)
            }   
        }
        return(fields)
    }

    //
    fetch(key) {  // should be written by descendant
        let data = ""
        return(data)
    }

    //
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    async static_store(asset) {  // for small size objects depending on the initialization parameters of the cache DB
        let data = ""
        if ( asset ) {
            try {
                data = await  this.sdb.get_key_value(asset)
                if ( data ) {
                    return(JSON.parse(data))
                }
            } catch(e) {
            }
        }
        return(data)
    }

    // wrap the object in a carrier, in which the object is serialized with its mime-type for future transport..
    // put the object in the static db, which attempts to keep a copy of the asset close to the processor on its own local disks...
    async put_static_store(whokey,text,mime_type,extension) {
        if ( (typeof text)  !== 'string' ) {
            text = JSON.stringify(text)
        }
        if ( this.sdb === undefined ) return
        let data = {
            'string' : text,
            'mime_type' : mime_type
        }
        if ( extension && ( typeof extension === 'object' ) ) {
            // don't overwrite the fields this storage is about.
            if ( extension.string !== undefined ) delete extension.string
            if ( extension.mime_type !== undefined  ) delete extension.mime_type
            data = Object.assign(data,extension)
        }
        await this.sdb.set_key_value(whokey,data)
    }

    async del_static_store(whokey) {
        if ( this.sdb === undefined ) return
        await this.sdb.del_key_value(whokey)
    }

    static_synchronizer(sync_function) {
        if ( this.sdb === undefined ) return
        if ( this.sdb.schedule === undefined ) return
        this.sdb.schedule(sync_function,this.static_sync_interval)
    }

    //
    //  ----  ----  ----  ----  ----  ----  ----  ----  ----
    // May use a backref 

    async store_cache(key,data,back_ref) {        // make use of the application chosen key-value implementation...
        //
        let ref = back_ref ? data[back_ref] : false;
        if ( ref ) {
            let ehash = this.hasher(key)
            await this.set_key_value(ref,ehash)
            await this.set_key_value(ehash,data)
        } else {
            //
            await this.set_key_value(key,data)
            //
        }
    }


    async cache_stored(key,body) {
        let ehash = this.hasher(key)
        try {
            let data = await this.get_key_value(ehash)
            if ( data ) {
                if ( (typeof data) === 'string' ) {
                    return JSON.parse(data)
                }
                return data
            } else return body
        } catch(e) {
            return body
        }
    }


    async update_cache(key,data,back_ref) {
        if ( typeof data !== 'string' ) {
            data = JSON.stringify(data)
        }
        let ref = back_ref ? data[back_ref] : false;
        if ( ref ) {
            let ehash = this.get_key_value(ref)
            if ( ehash !== false ) {
                await this.set_key_value(ehash,data)
            }
        } else {
            //
            await this.set_key_value(key,JSON.stringify(data))
            //
        }
    }
    

    //   ----  ----  ----  ----  ----  ----  ----  ----  ----  ----  ----

    // BASIC USER 

    // Some applications may elect to store user in the KV store. 
    // That is not the default behavior. The default behavior is to store the user in the persistence DB.
    async fetch_user_from_key_value_store(key) {
        if ( key == undefined ) return(false);
        try {
            let ehash = await this.get_key_value(key)
            if ( ehash === null || ehash === false ) {
                return(false)
            }
            if ( isHex(ehash) ) {
                try {
                    let u_data = await this.get_key_value(ehash)
                    if ( u_data ) {
                        if ( (typeof data) === 'string' ) {
                            return JSON.parse(data)
                        }        
                        return data
                    }
                    return false
                } catch (e) {
                    return false
                }    
            } else {
                try {
                    let data = ehash        // user data
                    if ( (typeof data) === 'string' ) {
                        return JSON.parse(data)
                    }        
                    return data
                } catch (e) {
                    return false
                }
            }
        } catch(e) {
            return false
        }
    }


    id_hashing(user_txt) {
        let id = global_hasher(user_txt)  // or this.oracular_storage()
        return id
    }

    // store_user
    // // just work with the presistent DB
    async store_user(udata,key,cb) { // up to the application...(?)
        let id = ''
        if ( key ) {
            id = udata[key]
        } else {
            id = udata.id
            if ( id === undefined ) {
                let user_txt
                if ( (typeof data) !== 'string' ) {
                    user_txt = JSON.stringify(udata)
                } else {
                    user_txt = data
                }
                id = await this.id_hashing(user_txt)  // or this.oracular_storage()
            }
        }
        udata._id = id
        udata._tx_directory_ensurance = true        // for the endpoint  -- might not need it    // m_path is user
        let result = await this.pdb.update(udata,false,'create')   // the end point will write information into files and create directories...
                                // a response service will react sending new information to subscribers...
        if ( cb !== undefined ) cb(result)
        return(id)
    }

    //
    async fetch_user(id,cb) { // up to the application...(?) // just work with the presistent DB
        return(await  this.pdb.findOne(id,cb))
    }

    // 
    async update_user(udata,key,cb) {     // just work with the presistent DB
        let id = ''
        if ( key ) {
            id = udata[key]
        } else {
            id = udata.id
        }
        if ( udata._id == undefined ) {
            udata._id = id
        }
        udata._tx_directory_ensurance = true   // m_path is user
        let result = await this.pdb.update(udata,false,'update')   // the end point will write information into files and create directories...
        if ( cb !== undefined ) cb(result)
    }

    // BASIC USER (end)

    //  ----  ----  ----  ----  ----  ----  ----  ----  ----
    //
    // in subclass 
    //
    store(collection,data) {}
    //
    exists(collection,query_components) {
        return(false)
    }
    //
    last_step_initalization() {}
    //
    drop() {}
    //
    disconnect() {
        console.log("implement in instance")
        return(false)
    }
}


module.exports = GeneralDBWrapperImpl
