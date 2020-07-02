const fs =  require('fs')
const { promisify } = require("util");
const AppLifeCycle = require("./general_lifecyle")

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
    constructor(sessStorage,keyValueDB) {
        super()
        //
        this.session_store = new sessStorage(this)
        this.key_value_db = keyValueDB
        //
        this.getAsync = promisify(keyValueDB.get)
    }

    initialize(conf) {}

    //
    set_key_value(token,key) {
        this.key_value_db.set(token,key)
    }

    del_key_value(token) {
        this.key_value_db.del(token,key)
    }

    async get_key_value(key) {
        try {
            let val = await this.getAsync(key)
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
    storeCache(key,body,back_ref) {
        const hash = crypto.createHash('sha256');
        hash.update(key);
        let ehash = hash.digest('hex');
        //
        let ref = body[back_ref];
        if ( ref ) {
            this.set_key_value(ref,ehash)
        }
        //
        this.set_key_value(ehash,JSON.stringify(body))
        //
    }


    async cacheStored(key,body) {
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
            try {
                let u_data = await this.get_key_value(ehash)
                return JSON.parse(u_data)
            } catch (e) {
                return false
            }
        } catch(e) {
            return false
        }
    }


    crypto_version(pass) {
        return(pass)
    }

    //
    store_user(udata) { // up to the application...(?)
    }

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
