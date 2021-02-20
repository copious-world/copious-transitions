const AppLifeCycle = require("./general_lifecyle")
const crypto = require('crypto')

const DEFAULT_STATIC_SYNC_INTERVAL = (1000*60*30)


class GeneralDBWrapperImpl extends AppLifeCycle {
    //
    constructor(keyValueDB,sessionKeyValueDB,persistentDB,staticDB) {
        super()
        //
        this.key_value_db = keyValueDB
        this.session_key_value_db = !(sessionKeyValueDB) ? keyValueDB : sessionKeyValueDB
        //
        if ( !(persistentDB) ) {
            this.pdb = require('./default_persistent_db')
        } else {
            this.pdb = persistentDB
        }
        //
        if ( !(staticDB) ) {
            this.sdb = require('./default_persistent_db')
        } else {
            this.sdb = staticDB
        }
        if ( this.sdb && (typeof this.sdb.setPersitence === 'function ') {
            this.sdb.setPersistence(this.pdb)
        }
    }

    // configuration for persistent DB...
    initialize(conf) {
        this.pdb.initialize(conf)           // initialize persitence...relative to the database
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
                /*
                if ( this.is_file(asset) ) {
                    data = this.load_file(asset)
                }
                */
            } catch(e) {
            }
        }
        return(data)
    }

    put_static_store(whokey,text,mime_type) {
        if ( (typeof text)  !== 'string' ) {
            text = JSON.stringify(text)
        }
        if ( this.sdb === undefined ) return
        let data = {
            'string' : text,
            'mime_type' : mime_type
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

    store_cache(key,data,back_ref) {
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


    // 
    store_user(udata,key,cb) { // up to the application...(?)
        if ( cb === undefined ) cb = ()=>{}
        let id = ''
        if ( key ) {
            id = udata[key]
        } else {
            id = udata.id
            if ( id === undefined ) {
                id = global_hasher(JSON.stringify(udata))
            }
        }
        udata._id = id
        this.pdb.create(udata,cb)
        return(id)
    }

    //
    fetch_user(id,cb) { // up to the application...(?)
        return(this.pdb.findOne(id,cb))
    }

    // 
    update_user(udata,key,cb) {
        let id = ''
        if ( key ) {
            id = udata[key]
        } else {
            id = udata.id
        }
        if ( udata._id == undefined ) {
            udata._id = id
        }
        this.pdb.update(udata,cb)
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
