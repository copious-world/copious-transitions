const fs =  require('fs')
const { promisify } = require("util");

class SessionStorage {
    //
    constructor(dbWrapper) {
        this.db_interface = dbWrapper
    }
    //
    madeByDBWrapper() {
        return( ( this.db_interface !== undefined ) && ( this.db_interface instanceof GeneralDBWrapper) )
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


class GeneralDBWrapper {

    //
    constructor(sessStorage,keyValueDB) {
        this.session_store = new sessStorage(this)
        this.key_value_db = keyValueDB
        //
        this.getAsync = promisify(keyValueDB.get).bind(client);
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
    store_user(udata) { // up to the application...(?)
    }

    exists(collection,query_components) {
        return(false)
    }

    last_step_initalization() {}
}



module.exports.GeneralDBWrapper = GeneralDBWrapper
module.exports.SessionStorage = SessionStorage

