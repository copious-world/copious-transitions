const { DBClass, SessionStore } = require.main.require('./lib/general_db')
const fs = require('fs')
const uuid = require('uuid/v4')

const PersistenceManager = require.main.require('./lib/global_persistence')
//
const apiKeys = require.main.require('./local/api_keys')
const g_persistence = new PersistenceManager(apiKeys.persistence,apiKeys.message_relays)
const g_ephemeral = new PersistenceManager(apiKeys.session)


const g_keyValueDB = g_persistence.get_LRUManager();      // leave it to the module to figure out how to connect
const g_keyValueSessions =  g_ephemeral.get_LRUManager();



const FORCE_FAIL_FETCH = "NotAnObject";

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class SongSearchSessionStore extends SessionStore {
    //
    constructor() {
        super()
    }
    //
}

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//
class SongSearchDBClass extends DBClass {

    //
    constructor() {
        let persistenceDB = undefined 
        super(SongSearchSessionStore,g_keyValueDB,g_keyValueSessions,persistenceDB)

        // CACHING AND LOCAL STORAGE
        this.cached_session_containers = {}       // one per user across that user's devices
        this.sessions_components = {}   // a list of recorder elements
        this.root_path = process.mainModule.path
    }



    get_from_container_cache(session_id) {
        let sessObj = this.cached_session_containers[session_id]
        if ( sessObj ) {
            return sessObj
        }        
        return(FORCE_FAIL_FETCH)
    }

    // cache_container_if_found
    async cache_container_if_found(session_id,and_with,transformer) {
        let sessObj = this.cached_session_containers[session_id]  // is it in cache?
        if ( sessObj ) {
            return sessObj
        } else {
            let datum = await super.get_key_value(session_id)   // get it out of key value store... (may need file storage)
            if ( datum ) {
                if ( transformer === undefined ) transformer = async (dat) => dat
                this.cached_session_containers[session_id] = await transformer(datum)    // if found
                return this.cached_session_containers[session_id]
            } else if ( and_with ) {    // expand the key and try again..
                for ( let key in and_with ) {
                    let search_value = and_with[key]
                    let search_key = `${key}-${search_value}`
                    let datm_container = await super.get_key_value(search_key)
                    if ( datm_container ) {
                        let container = JSON.parse(datm_container)
                        if ( container[session_id] ) {
                            this.cached_session_containers[session_id] = container[session_id]
                            // return from loop
                            return this.cached_session_containers[session_id]
                        }
                    }
                }
            }
        }
        return(false)
    }

    //
    // component_cache_if_found --
    // manages objects that take in data from recording.
    // An object is located by its session_id and its sess_name
    // the session_id maps to a collection of recording sessions, each with its name
    // If the session object is not in caches, this routine create an object and places it in caches
    async component_cache_if_found(CachableOperationsClass,session_id,sess_name,transformer) {
        let key = `${session_id}-${sess_name}`  // session_id -- a user's collection of sessions, sess_name -- a particular session
        let sessionComponent = this.sessions_components[key] // look for the object in caches
        if ( sessionComponent ) {
            return(sessionComponent)
        } else {    // if not in cache
            // Deal first with getting the container of the session
            // retrieve from DB if not yet loaded
            let sessContainer = await this.cache_container_if_found(session_id,false,transformer)  // load the larger object containing parts of the sessions
            if ( sessContainer ) {
                if ( sessContainer.assets === undefined ) {  // first time here
                    sessContainer.assets = {}
                }
                let activeSession = sessContainer.assets[sess_name] // this is the smaller part, with the active session
                if ( !activeSession ) { // make sure there is an asset container for the named session component.
                    sessContainer.assets[sess_name] = {
                        'hashes' : [],
                        'blob_list' : []
                    }
                    activeSession = sessContainer.assets[sess_name] 
                }
                //  The object encompases the smaller active session part, and this object lives in caches
                sessionComponent = new CachableOperationsClass(activeSession) // 
                this.sessions_components[key] = sessionComponent    // put it into cache
                return sessionComponent
            } else return false // no container of active sessions (past and present) // depends on there being a user
        }
    }

    async store_component_section(CachableOperationsClass,session_id,sess_name,source_ComponentFields,update)  {
        let key = `${session_id}-${sess_name}`
        let sessContainer = this.get_from_container_cache(session_id)  // changed in caches
        let sessionComponent = this.sessions_components[key]
        if ( (sessContainer === undefined) || (sessionComponent == undefined) ) {
            // say someone sends and edit after some time: hence, no object is cached due to recording
            sessionComponent = await this.component_cache_if_found(CachableOperationsClass,session_id,sess_name,this.file_transformer_parse)
        }
        if ( sessionComponent ) {
            sessionComponent.add_fields(source_ComponentFields)
        }
        if ( sessContainer && (sessContainer !== FORCE_FAIL_FETCH) ) {
            let filename = await super.get_key_value(session_id)
            await this.store_to_file_promise(sessContainer,filename)
        }
        return sessionComponent
    }

    // // //
    file_transformer(filename) {
        let p = new Promise((resolve,reject) => {
            fs.readFile(filename,(error,data) => {
                if ( error ) reject(error)
                resolve(data.toString())
            })
        })
        return p
    }

    file_transformer_parse(filename) {
        let p = new Promise((resolve,reject) => {
            fs.readFile(filename,(error,data) => {
                if ( error ) reject(error)
                try {
                    let obj = JSON.parse(data.toString())
                    resolve(obj)
                } catch (e) { // parse
                    resolve({ "assets" : {} })
                }
            })
        })
        return p
    }


    store_to_file_promise(obj,filename,returnable) {
        let output = JSON.stringify(obj)
        let p = new Promise((resolve,reject) => {
            fs.writeFile(filename,output,(error) => {
                if ( error ) reject(error)
                if ( returnable !== undefined ) resolve(returnable)
                else resolve(true)
            })
        })
        return p
    }

    async fetch_file_class(storage_class,key) {
        let policy_key = `${storage_class}-${key}`
        try {
            let filename = await super.get_key_value(policy_key)
            if ( filename ) {
                let prefix = this.root_path + '/user_keys/'
                let abspath = prefix + filename
                let p = this.file_transformer(abspath)
                return p
            } else if ( filename === null ) {
                return(null)
            }
        } catch (e) {
            console.log(e)
        }
        return false
    }

    async store_file_class(storage_class,key,audioSessionRep) {
        let policy_key = `${storage_class}-${key}`
        let uuid_file_name = await super.get_key_value(policy_key)
        if ( uuid_file_name === null || uuid_file_name === undefined ) {
            uuid_file_name = ('' + uuid())
        }
        super.set_key_value(policy_key,uuid_file_name)
        let filename = this.root_path + '/user_keys/' + uuid_file_name
        return this.store_to_file_promise(audioSessionRep,filename,policy_key)
    }


    schedule_cache_backup() {
        // ensure the timer is functional for the next benchmark serialization
    }


}

//
//
module.exports = new SongSearchDBClass()
