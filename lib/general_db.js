const AppLifeCycle = require("./general_lifecyle")
const crypto = require('crypto')

const DEFAULT_STATIC_SYNC_INTERVAL = (1000*60*30)


class GeneralDBWrapperImpl extends AppLifeCycle {
    //
    constructor(keyValueDB,sessionKeyValueDB,persistentDB,staticDB) {
        //
        super()
        //
        // EPHEMERAL (in memory will be erased when the application turns off.. BUT -- may be replicated on nodes with checkpoint writes)
        this.key_value_db = keyValueDB      // MEMORY BASED (SHARED MEM)
        this.session_key_value_db = !(sessionKeyValueDB) ? keyValueDB : sessionKeyValueDB // MEMORY BASED (SHARED MEM)
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

    //  KEY VALUE cache like DB in memory.  e.g. an interface to shm-lru-cache 
    set_key_value(key,value) {
        this.key_value_db.set(key,value)
    }

    //
    del_key_value(token) {
        this.key_value_db.delete(token)
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
    set_session_key_value(key,value) {
        return this.session_key_value_db.hash_set(key,value)
    }

    //
    del_session_key_value(key) {
        this.session_key_value_db.delete(key)
    }

    //
    get_session_key_value(key) {
        try {
            let value = this.session_key_value_db.get(key)
            return value    
        } catch (e) {
            console.log(e)
            return null
        }  
    }

    
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    //
    fetch_fields(fields_key) {
        // 
        let fields = {}
        if ( fields_key ) {
            fields = JSON.parse(this.fetch(fields_key))
        }
        return(fields)
    }

    //
    fetch(key) {
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
    put_static_store(whokey,text,mime_type,extension) {
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
        this.sdb.set_key_value(whokey,data)
    }

    del_static_store(whokey) {
        if ( this.sdb === undefined ) return
        this.sdb.del_key_value(whokey)
    }

    static_synchronizer(sync_function) {
        if ( this.sdb === undefined ) return
        if ( this.sdb.schedule === undefined ) return
        this.sdb.schedule(sync_function,this.static_sync_interval)
    }

    //
    //  ----  ----  ----  ----  ----  ----  ----  ----  ----
    // May use a backref 

    store_cache(key,data,back_ref) {        // make use of the application chosen key-value implementation...
        //
        let ref = back_ref ? data[back_ref] : false;
        if ( ref ) {
            const hash = crypto.createHash('sha256');
            hash.update(key);
            let ehash = hash.digest('hex');
            //
            this.set_key_value(ref,ehash)
            this.set_key_value(ehash,data)
        } else {
            //
            this.set_key_value(key,data)
            //
        }
    }

    update_cache(key,data,back_ref) {
        let ref = back_ref ? data[back_ref] : false;
        if ( ref ) {
            let ehash = this.get_key_value(ref)
            if ( ehash !== false ) {
                this.set_key_value(ehash,JSON.stringify(data))
            }
        } else {
            //
            this.set_key_value(key,JSON.stringify(data))
            //
        }
    }
    

    async cache_stored(key,body) {
        const hash = crypto.createHash('sha256');
        hash.update(key);
        let ehash = hash.digest('hex');
        try {
            let data = this.get_key_value(ehash)
            if ( data ) {
                return JSON.parse(data)
            } else return body
        } catch(e) {
            return body
        }
    }


    //   ----  ----  ----  ----  ----  ----  ----  ----  ----  ----  ----

    // BASIC USER 

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
                        return JSON.parse(u_data)
                    }
                    return false
                } catch (e) {
                    return false
                }    
            } else {
                try {
                    let u_data = ehash
                    return JSON.parse(u_data)
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
        if ( cb === undefined ) cb = ()=>{}
        let id = ''
        if ( key ) {
            id = udata[key]
        } else {
            id = udata.id
            if ( id === undefined ) {
                let user_txt = JSON.stringify(udata)
                id = await this.id_hashing(user_txt)  // or this.oracular_storage()
            }
        }
        udata._id = id
        udata._user_op = 'create'    // for the endpoint service
        udata._m_path = 'user'       // for the relay service (midpoint)
        udata._tx_directory_ensurance = true
        this.pdb.create(udata,cb)   // the end point will write information into files and create directories...
                                    // a response service will react sending new information to subscribers...
        return(id)
    }

    //
    fetch_user(id,cb) { // up to the application...(?) // just work with the presistent DB
        return(this.pdb.findOne(id,cb))
    }

    // 
    update_user(udata,key,cb) {     // just work with the presistent DB
        let id = ''
        if ( key ) {
            id = udata[key]
        } else {
            id = udata.id
        }
        if ( udata._id == undefined ) {
            udata._id = id
        }
        udata._user_op = 'update'    // for the endpoint service
        udata._m_path = 'user'       // for the relay service (midpoint)
        udata._tx_directory_ensurance = true
        this.pdb.update(udata,cb)   // the end point will write information into files, doing updates...
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


exports.DBClass = GeneralDBWrapperImpl
