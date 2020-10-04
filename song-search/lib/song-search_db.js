const { DBClass, SessionStore } = require.main.require('./lib/general_db')
const processExists = require('process-exists');
const fs = require('fs')
const uuid = require('uuid/v4')

//const EventEmitter = require('events')
//const cached = require('cached')
//
//
const MemCacheStoreFactory = require('connect-memcached');
var MemcachePlus = require('memcache-plus');

const FORCE_FAIL_FETCH = "NotAnObject";

//const apiKeys = require.main.require('./local/api_keys')

// pre initialization

(async () => {
  const exists = await processExists('memcached');
  if ( !exists ) {
    console.log("Memchached deamon has not been intialized")
    process.exit(1)
  }
})();

const memcdClient = new MemcachePlus(); //new Memcached('localhost:11211');  // leave it to the module to figure out how to connect

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class SongSearchSessionStore extends SessionStore {
    //
    constructor() {
        super()
    }
    //

    //
    generateStore(expressSession) {
        if ( super.can_generate_store(expressSession,true) ) {
            // custom code goes here
            let MemcachedStore = new MemCacheStoreFactory(expressSession)
            return (new MemcachedStore({ client: memcdClient }))
        } else {
            process.exit(1)
        }
    }
    //
}

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//
class SongSearchDBClass extends DBClass {

    //
    constructor() {
        super(SongSearchSessionStore,memcdClient)

        // CACHING AND LOCAL STORAGE
        this.cached_sessions = {}
        this.sessions_components = {}
        this.root_path = process.mainModule.path
    }

    get_from_cache(session_id) {
        let sessObj = this.cached_sessions[session_id]
        if ( sessObj ) {
            return sessObj
        }        
        return(FORCE_FAIL_FETCH)
    }

    async cache_if_found(session_id,and_with) {
        let sessObj = this.cached_sessions[session_id]
        if ( sessObj ) {
            this.cached_sessions[session_id] = sessObj
            return true
        } else {
            let datum = await super.get_key_value(session_id)
            if ( datum ) {
                this.cached_sessions[session_id] = JSON.parse(datum)
                return true
            } else if ( and_with ) {
                for ( let key in and_with ) {
                    let search_value = and_with[key]
                    let search_key = `${key}-${search_value}`
                    let datm_container = await super.get_key_value(search_key)
                    if ( datm_container ) {
                        let container = JSON.parse(datm_container)
                        if ( container[session_id] ) {
                            this.cached_sessions[session_id] = container[session_id]
                            // return from loop
                            return true
                        }
                    }
                }
            }
        }
        return(false)
    }

    //
    async component_cache_if_found(CachableOperationsClass,session_id,sess_name) {
        let key = `${session_id}-${sess_name}`
        let sessionComponent = this.sessions_components[key]
        if ( sessionComponent ) {
            return(sessionComponent)
        } else {
            let sessContainer = this.cache_if_found(session_id)
            let activeSession = sessContainer.assets[sess_name]
            if ( !activeSession ) {
                sessContainer.assets[sess_name] = {
                    'hashes' : [],
                    'blob_list' : []
                }
            }
            //
            sessionComponent = new CachableOperationsClass(activeSession)
            this.sessions_components[key] = sessionComponent
            sessionComponent.need_info
            return sessionComponent
        }
    }

    store_component_section(session_id,sess_name,sessCompFields,update)  {
        let key = `${session_id}-${sess_name}`
        let sessContainer = this.get_from_cache(session_id)
        let sessionComponent = this.sessions_components[key]
        if ( sessContainer ) {
            if ( sessionComponent ) {
                sessionComponent.add_fields(sessCompFields)
                this.db.set_key_value(session_id,JSON.stringify(sessContainer))
            }
        }
        return sessionComponent
    }

    async fetch_file_class(stroge_class,key) {
        let policy_key = `${stroge_class}-${key}`
        try {
            let filename = await super.get_key_value(policy_key)
            if ( filename ) {
                let p = new Promise((reslove,reject) => {
                    fs.readFile(filename,(error,data) => {
                        if ( error ) reject(error)
                        reslove(data.toString())
                    })
                })
                return p
            }
        } catch (e) {
            console.log(e)
        }
        return false
    }

    async store_file_class(stroge_class,key,audioSessionRep) {
        let policy_key = `${stroge_class}-${key}`
        let filename = await super.get_key_value(policy_key)
        if ( filename === null || filename === undefined  ) {
            filename = this.root_path + '/' + ('' + uuid())
        }
        super.set_key_value(policy_key,filename)
        let output = JSON.stringify(audioSessionRep)
        let p = new Promise((reslove,reject) => {
            fs.writeFile(filename,output,(error) => {
                if ( error ) reject(error)
                reslove(policy_key)
            })
        })
        return p
    }


    schedule_cache_backup() {
        // ensure the timer is functional for the next benchmark serialization
    }


}

//
//
module.exports = new SongSearchDBClass()
