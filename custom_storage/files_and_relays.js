//
const AppLifeCycle = require('../lib/general_lifecyle')
const fs = require('fs')


const DB_STASH_INTERVAL = 10000
const AGED_OUT_DELTA = (1000*60*30)

// This module is supplied as a default for the copious-transitions module.
// newer modules use the repository bridge and store large objects via the repo bridge and the JSON is just a meta object

/**
 * Remote messaging is an interface based on the relay clients of the module message-relay-services.
 * For this stack (default storage stack for Copious Transitions) the client intiates all activiy.
 * 
 * Most requests for information will be keyed by the `_id` field, which is supposed to store a wide area identifier of the object.
 * 
 * When the `field` parameter is used, the client, that this class represents, expects that the `_x_key_field`
 * will be useful to the data service (e.g a DB).
 * 
 * Given that this client wrapper may interact with a relay services managing paths, the request are sent on a path.
 * The path may be configured. The constructor will use `default_m_path` in some cases, but it is not specified, 
 * 'persistence' will be the path used by default.
 * 
 */
class RemoteMessaging extends AppLifeCycle {
    //
    constructor(persistence_messenger,default_m_path) {
        super()
        this.default_m_path = default_m_path ? default_m_path : 'persistence'
        this.messenger = persistence_messenger
        if ( this.messenger === undefined ) {
            throw new Error("Files and Relays -- must have a defined messenger -- cannot proceed without it.")
        }
    }

    /// --- COMMUNICATION METHODS....

    // remote_fetch_message --- this is a request -- meta search request...
    // calls get on path. ... older code relies less on upstream data handling --- may still be useful
    /**
     * remote_fetch_message --- this is a request -- meta search request...
     * calls get on path
     * 
     * @param {string} wa_id - The wide area id of the object
     * @param {string} field - the field that is to be used as the key for identifying the object `_id` is the default.
     * @returns {object|boolean}  - returns the recovered object or false
     */
    async remote_fetch_message(wa_id,field) {          // expect no local object -- use universal id locator
        let m_path = this.default_m_path
        let msg = {
            "_id"  : wa_id      // should be enought for it search
        }
        if ( field !== undefined ) {
            msg._x_key_field = field    // the name of the field for services that need to have it defined by the caller
            msg[field] = wa_id
        }
        let response = await this.messenger.get_on_path(msg,m_path)
        if ( response ) {
            if ( typeof response === 'object' ) {
                if ( response.msg ) return response.msg    // (may change) the msg field can be used for messaging not having to do with data.
                if ( response.status === "OK") {
                    let data = response.data    // The object that is being received will be in the data field of the response.
                    if ( typeof data === "string" ) {
                        try {
                            let obj = JSON.parse(data)
                            return obj
                        } catch (e) {}  // parse error
                    }
                    return response.data    // if the data can't be parsed, return the data as a string.
                }
                if ( (response.status === "ERR") || (response.status === undefined) ) {
                    return false
                }
            }
            return response
        }
        return(false)
    }


    /// remote_store_message -- ask remote db to store a copy of this object....
    /**
     * 
     * @param {object} obj -- the data object that will be stored remotely.
     * @param {string} user_op -- this is used if the message is going to an endpoint providing operations.
     * @returns 
     */
    remote_store_message(obj,user_op) {
        if ( obj === undefined ) return
        if ( user_op ) obj._user_op = user_op
        let m_path = obj._m_path ? obj._m_path : this.default_m_path
        let msg = Object.assign({},obj)     // the message handling message might alter the object... leave the same locally
        this.messenger.set_on_path(msg,m_path)
    }


    /// tell systems that this processor has authority to remove the object in question 
    /// may turn to the repo bridge to unpin the object

    /**
     * Let remote systems know that this objet is not going to be stored locally.
     * 
     * If the architecture is set up to keep objects for a number of users, the object might not 
     * be removed from existence by other process, but those processes might keep track of how many copies 
     * are in existence.
     * 
     * @param {string} wa_id - the wide area identity
     */
    remote_store_dereference(wa_id) {
        let m_path = this.default_m_path
        let msg = {
            "_id"  : wa_id
        }
        this.messenger.del_on_path(msg,m_path)
    }

}




// LocalStorageLifeCycle 
//  ---- Time and identity
/**
 * Handles the management of the storage map and the time for objects to stay in memory completely.
 * Some objects can timeout and be removed from the storage map. 
 * 
 * This class keeps objects in time buckets. If an object is accessed it will be moved to a newer bucket.
 */
class LocalStorageLifeCycle extends RemoteMessaging {

    constructor(persistence_messenger,stash_interval,default_m_path) {
        super(persistence_messenger,default_m_path)

        this._storage_map = {}
        this._time_to_id = {}
        this._age_out_delta = AGED_OUT_DELTA
        
        this.stash_interval = stash_interval ? stash_interval : DB_STASH_INTERVAL
    }

    /**
     * Look for a special subobject in configurations for this configuration. For example, StaticDB has `conf.static_db`.
     * 
     * This intializer loads the storage map. The storage map either contains complete objects or partial objects and indicators
     * of where complete objects are stored on local disks.
     * 
     * @param {object} conf 
     */
    async initialize(conf) {
        // 
        try {
            this._storage_map = await this.local_db_load_map()
            this.chrono_update_all()
        } catch(e) {
            if ( e.code !== "ENOENT" ) {
                console.dir(e)
                process.exit(1)
            }
        }

        //
        //  PUT CURRENT DATA INTO A LOCAL FILE ON A PERIODIC BASIS
        let extant_interval = setInterval(async () => {
            if ( this.dirty ) {
                this.prune_storage_map()
                await this.local_db_store_map(this._storage_map)
            }
        },this.stash_interval)
        //
        this._age_out_delta = (conf.persistence_aging ? parseInt(conf.persistence_aging) : this._age_out_delta)
        this.add_interval(extant_interval)  // from App Life Cycle ----
    }

    /**
     * Stores the `_storage_map` object in the file `db_file`.
     * 
     * @param {object} storage_map 
     */
    async local_db_store_map(storage_map) {
        try {
            fs.writeFile(this.db_file,JSON.stringify(storage_map),() => { this.dirty = false })
        } catch(e) {
        }
    }

    /**
     * Reads in the storage map from disk and loads it.
     * 
     * @returns {object} the storage map object that is in the file on disk as an object.
     */
    async local_db_load_map() {
        try {
            let store_map = JSON.parse(fs.readFileSync(this.db_file,'ascii').toString())
            return store_map
        } catch (e) {}
        return {}
    }

    // add_t_stamp -- for aging out data
    //
    /**
     * 
     * @param {Number} tstamp - a timestamp
     * @param {string} id - 
     */
    add_t_stamp(tstamp,id) {
        if ( this._time_to_id[tstamp] == undefined ) {
            this._time_to_id[tstamp] = {}
        }
        this._time_to_id[tstamp][id] = 1
    }

    // object_add_t_stamp -- for aging out data
    //
    /**
     * Put the object in a timestamp bucket when it is first placed into storage.
     * @param {object} obj 
     */
    object_add_t_stamp(obj) {
        let tstamp = Date.now()
        obj._tstamp = tstamp
        let id = obj._id
        //
        if ( this._time_to_id[tstamp] == undefined ) {
            this._time_to_id[tstamp] = {}
        }
        this._time_to_id[tstamp][id] = 1
    }


    //  update_stamp
    //  -- #_remove_stamp
    /**
     * 
     * @param {Number} tstamp 
     * @param {string} id 
     */
    #_remove_stamp(tstamp,id) {
        let ids = this._time_to_id[tstamp]
        if ( ids !== undefined ) {
            delete this._time_to_id[tstamp][id]
        }
    }

    // update_stamp -- when data is touched make it newer
    /**
     * when data is touched make it newer
     * 
     * Removes the object from an old bucket and puts it in a new one.
     * 
     * @param {Number} tstamp 
     * @param {string} id 
     * @returns {Number} - the new timestamp
     */
    update_stamp(tstamp,id) {
        this.#_remove_stamp(tstamp,id)
        let new_t = Date.now()
        this.add_t_stamp(new_t,id)
        return new_t
    }

    /**
     * Changes the timestamp of the object calling `update_stamp` after the object wide area id has been found.
     * 
     * @param {object} obj 
     */
    object_update_stamp(obj) {
        let tstamp = obj._tstamp
        let id = obj._id
        if ( id === undefined ) return  // the update cannot happen without an id, and the object should not be here without one.
        obj._tstamp = this.update_stamp(tstamp,id)
    }


    /// -----  OBJECT IDENTITY
    /**
     * Returns true if the object is not in the storage map
     * @param {object} obj 
     * @returns 
     */
    missing(obj) {
        let id = obj._id
        if ( this._storage_map[id] === undefined ) return true
        return false
    }

    /**
     * Calls `global_appwide_token` on behalf of the class.
     * 
     * Subclasses should override if they want to use this class outside the context of a Copious Transitions application.
     * 
     * @returns {string} - the wide are id for the object
     */
    id_maker() {
        return global_appwide_token()
    }

    /**
     * If the object is in the storage map and keyed by the wide area id, then make a hash of the object and return it.
     * 
     * @param {string} id 
     * @returns {string|boolean} - the universal hash of the object or false
     */
    hash_from_key(id) {
        let obj = this._storage_map[id]
        if ( obj ) {
            let hh = this.application_hash_key(obj)
            if ( hh ) return(hh)
        }
        return false
    }

    /**
     * Put an object into a timestamp map.
     * 
     * If the object does not have a wide area id, then this method makes one and adds it in the `_id` field.
     * 
     * @param {object} obj 
     * @returns {Error|boolean} - if the object is stored, returns an Error, otherwise false (indicates to bypass error handling)
     */
    add_to_storage_map(obj) {
        //
        if ( obj._id && this._storage_map[obj._id] ) {
            return new Error("already exists")
        }
        if ( !obj._id ) {
            obj._id = this.id_maker()
        }
        this._storage_map[obj._id] = obj  // if there is a lot of data here, this is only a reference... fix it after sending...
        this.object_add_t_stamp(obj)
        this.dirty = true
    }
    
    //
    /**
     * Erases the object form the `_storage_map`
     * @param {string} id 
     * @returns {boolean}  true for success - false otherwise
     */
    remove_from_storage_map(id) {
        if ( !(this._storage_map[id]) ) {
            return false
        }
        delete this._storage_map[id]
        return true
    }


    /// -----  OBJECT TIME in memory
    /**
     * Updates all the timestamps of all the objects in the storage map.
     * Usually called just in intialization ... starts the clock on each piece of data...
     */
    chrono_update_all() {   // usually called just in intialization ... starts the clock on each piece of data...
        this._time_to_id = {}
        for ( let id in this._storage_map ) {
            let tstamp = Date.now()
            this.add_t_stamp(tstamp,id)
            this._storage_map[id]._tstamp = tstamp
        }
    }
    
    // -- prune_storage_map
    //
    /**
     * Prune storage based on time stamps and the current processor time.
     */
    prune_storage_map() {       // called in the initializer
        let ctime = Date.now()
        let stamps = Object.keys(this._time_to_id)
        stamps.sort()
        ctime -= this._age_out_delta
        while ( stamps.length > 0  ) {
            let ts = stamps.shift()
            if ( ctime > ts ) {
                let ids = this._time_to_id[ts]
                this.remote_store_sync(ids,true)
                if ( Object.keys(ids) == 0 ) {
                    delete this._time_to_id[ts]
                }
            }
        }
    }

}

/// --- Application Customization --  hooks and handlers
/// Includes: data entry 

/**
 * 
 */
class ApplicationCustomizationMethods extends LocalStorageLifeCycle {

    constructor(persistence_messenger,stash_interval,default_m_path) {
        super(persistence_messenger,stash_interval,default_m_path)
    }

    // APPLICATION METHODS this class

    // application_stash_large_data -- what to do with a BLOB
    application_stash_large_data(obj) { return obj }
    application_large_data_from_stash(obj) { return obj }
    application_clear_large_data(obj) {}

    // map keys to local use cases
    application_fix_keys_obj(obj,key,field) {}
    application_hash_key(obj) { return 0 }

    // called by application
    app_shutdown() {
        fs.writeFileSync(this.db_file,JSON.stringify(this._storage_map))
        this.shutdown()  //-- stops intervals,etc without a methods app_shutdown(), this does nothing to the running application
    }


    // allow the application to publish any object as on a topic of its choosing.
    async publish(topic,obj) {
        let response = await this.messenger.publish(topic,obj)
        return response
    }

    // STUB: subscription handling
    // The application can make a handler in a descendant if this has subscribed to the topic
    app_subscription_handler(topic,msg) {
        console.warn("Files and Relays -- has no subscription handler for any topic")
    }
}

//
/**
 * Deals with CRUD operations for data. 
 */
class FilesAndRelays_base extends ApplicationCustomizationMethods {
    //
    constructor(persistence_messenger,stash_interval,default_m_path) {
        super(persistence_messenger,stash_interval,default_m_path)
        this.root_path = require.main.path
        this.dirty = false
        this._search_attempted = false
    }


    // The pub/sub aspect of this data management interface allows subscription 
    // to a number of topics refered to as knowledge_domains. Knowledge domains are listed in an array on the configuration.
    // This initialization subscribes to a number of topcis and then passes the subscription response down to the 
    // application implementation
    /**
     * 
     * @param {object} conf 
     */
    initialize(conf) {
        //
        super.initialize(conf)
        // 
        if ( conf.persistence_db ) {   // just that some configurations may be passed in this fashion 
            conf = conf.persistence_db 
        }
        // Read previously locally stored records (default is users..) Build the storage map
        this.db_file = this.root_path + '/' + (conf.db_file ? conf.db_file : 'userdata.db')
        // 
        super.initialize(conf)
        //
        if ( conf === undefined ) {
            console.log("files and relays: initialize: no configuration parameter ... shutting down")
            process.exit(0)
        }
        //
        // Subscribe to new information coming in on this local channel (default.. users)
        let knowledge_domains = conf.knowledge_domains ? conf.knowledge_domains : undefined
        if ( knowledge_domains && knowledge_domains.length ) {
            knowledge_domains.array.forEach(kd => {
                let topic = kd.topic
                if ( topic ) {
                    let topic_handler = ((topc) => {
                        return (msg) => { this.app_subscription_handler(topc,msg) }
                    })(topic)
                    this.messenger.subscribe(topic,{},topic_handler)
                }
            });
        }
    }


    // remote_store - synchronizing the storage map with the remote DB interface
    // store many id's remotely  --- call to the messaging services
    /**
     * Looks through all the objecs in the `_storage_map` and tells the remote store about them.
     * If the *prune* parameter is provded, deletes the object from the `do_remote`. 
     * 
     * This is a helper method that does its task without asking anymore questions.
     * 
     * @param {string} ids 
     * @param {boolean} prune 
     */
    remote_store_sync(ids,prune) {
        for ( let id in ids ) {
            let obj = this._storage_map[id]
            this.remote_store_message(obj)
            if ( prune ) {
                delete this._storage_map[id]
                delete ids[id]
            }
        }
    }

    /// --- DB ORIENTED METHODS....

    /**
     * Enters the object into the storage map. Tells the application to handle it in case that it is large.
     * Tells the remote storage partners that this has created a new object for them to know about.
     * 
     * @param {object} obj 
     * @param {boolean} do_remote -- provided for applicationst that would like to prevent telling the remotes every time an object is created
     */
    #create(obj,do_remote) {  // only call from a failed search attempt
        //
        this.add_to_storage_map(obj)
        // the object in 'storage_map' is not going to keep lots of data around
        // the data is assumed to be in a remote machine (e.g. db server or other...)
        // sender is a copy (prefer local copy and tell the remote...)
        // application_stash_large_data -- returns a meta description of this object... 
        let sender = this.application_stash_large_data(obj)     // so make the app responsible for managing the large data
        this.remote_store_message(sender,'create')             // send it away, large data and all....    
    }

    // findOne -- returns false if the object is nowhere...
    //      --- only the static descendant has to worry about dont_create
    /**
     * 
     * @param {string} id 
     * @param {boolean} dont_create 
     * @returns 
     */
    async findOne(id,dont_create) {
        // check the storage map first....
        let obj = this._storage_map[id]
        if ( !( obj ) ) {
            obj = await this.remote_fetch_message(id)   // by id only
            if ( !( obj ) ) {
                return false
            }
            if ( !(dont_create) ) {
                this.#create(obj)   // remote data will be stashed before unstashing...
            } else return obj
        }
        this.object_update_stamp(obj)
        //
        let app_version = await this.application_large_data_from_stash(obj)
        return(app_version)
    }

    // like findOne, but will return false if the remote object cannot be found
    /**
     * 
     * @param {string} key 
     * @param {string} field 
     * @returns 
     */
    async search_one(key,field) {
        // don't check the stash
        let obj = await this.remote_fetch_message(key,field)    // by key in chosen field
        if ( !( obj ) ) {
            return false
        }
        //
        this.application_fix_keys_obj(obj,key,field)
        let app_version = await this.application_large_data_from_stash(obj)
        return(app_version)
    }

    /**
     * 
     * @param {object} obj 
     * @param {boolean} dont_remote 
     * @param {string} udpate_op 
     * @returns 
     */
    async update(obj,dont_remote,udpate_op) {
        let e = this.add_to_storage_map(obj)
        if ( e ) return e
        //
        if ( !dont_remote ) {
            let sender = await this.application_large_data_from_stash(obj)
            let uop = udpate_op ? udpate_op : 'update'
            this.remote_store_message(sender,uop)
            this.dirty = true           // don't stash what was just unstashed
            return(false)  // false is good
        }
        this.application_stash_large_data(obj)
        this.dirty = true
        return(false)  // false is good
    }


    /**
     * 
     * @param {string} id 
     * @param {boolean} dont_remote -- true if the object should be removed remotely
     * @returns 
     */
    delete(id,dont_remote) {
        this.application_clear_large_data(this._storage_map[id])
        this.remove_from_storage_map(id)
        if ( !(dont_remote) ) this.remote_store_dereference(id)
        this.dirty = true
        return(false)
    }

    //
    /**
     * 
     * @returns an array (list) of wide area identifiers
     */
    all_keys() {
        return(Object.keys(this._storage_map))
    }

}


// EXPORT ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- 

// FilesAndRelays
//      ---- Expose the methods to the descendant modules here

class FilesAndRelays extends FilesAndRelays_base {
    constructor(persistence_messenger,stash_interval,default_m_path) {
        super(persistence_messenger,stash_interval,default_m_path)
    }
}



module.exports = FilesAndRelays