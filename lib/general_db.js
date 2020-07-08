const fs =  require('fs')
const { promisify } = require("util");
const AppLifeCycle = require("./general_lifecyle")
const crypto = require('crypto')

class SessionStorageImpl extends AppLifeCycle {
    //
    constructor(dbWrapper) {
        super()
        this.db_interface = dbWrapper
    }
    //
    madeByDBWrapper() {
        return( ( this.db_interface !== undefined ) && ( this.db_interface instanceof GeneralDBWrapperImpl) )
    }
    //
    can_generate_store(sessionGenerator,override) {
        if ( sessionGenerator === undefined ) {
            return false
        }
        if ( !(this.madeByDBWrapper()) ) {
            return false
        }
        if ( override ) {
            // can check sessionGenerator for validity -- this is part of starting up however. 
            return true
        }
        return(false)
    }

}


class GeneralDBWrapperImpl extends AppLifeCycle {

    //
    constructor(sessStorage,keyValueDB,persistentDB) {
        super()
        //
        this.session_store = new sessStorage(this)
        this.key_value_db = keyValueDB
        //
        //
        
        if ( persistentDB === undefined ) {
            this.pdb = require('./default_persistent_db')
        } else {
            this.pdb = persistentDB
        }
    }

    initialize(conf) {
        this.pdb.initialize(conf)
    }

    //
    set_key_value(token,key) {
        this.key_value_db.set(token,key)
    }

    del_key_value(token) {
        this.key_value_db.del(token,key)
    }

    async get_key_value(key) {
        try {
            let val = await this.key_value_db.get(key)
            return val
        } catch(e) {
            return null
        }
    }

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
    static_store(asset) {
        let data = ""
        return(data)
    }

    //
    store_cache(key,data,back_ref) {
        //
        let ref = back_ref ? data[back_ref] : false;
        if ( ref ) {
            const hash = crypto.createHash('sha256');
            hash.update(key);
            let ehash = hash.digest('hex');
            //
            this.set_key_value(ref,ehash)
            this.set_key_value(ehash,JSON.stringify(data))
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
            return JSON.parse(data)
        } catch(e) {
            return body
        }
    }


    async fetch_user_from_key_value_store(key) {
        if ( key == undefined ) return(false);
        try {
            let ehash = await this.get_key_value(key)
            if ( ehash == null ) {
                return(false)
            }
            if ( isHex(ehash) ) {
                try {
                    let u_data = await this.get_key_value(ehash)
                    return JSON.parse(u_data)
                } catch (e) {
                    return false
                }    
            } else {
                let u_data = ehash
                return JSON.parse(u_data)
            }
        } catch(e) {
            return false
        }
    }

    // BASIC USER 

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
        this.pdb.create({ 
            '_id' : id,
            'user' : udata
        },cb)
    }

    //
    fetch_user(id,cb) { // up to the application...(?)
        return(this.pdb.findOne(id,cb))
    }

    update_user(udata) {

    }

    // BASIC USER (end)

    store_user_secret(reset_info) {
    }

    //
    store(collection,data) {

    }

    //
    exists(collection,query_components) {
        return(false)
    }

    last_step_initalization() {}
}


exports.DBClass = GeneralDBWrapperImpl
exports.SessionStore = SessionStorageImpl
