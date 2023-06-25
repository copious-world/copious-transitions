//
const AppLifeCycle = require('../lib/general_lifecyle')
const fs = require('fs')
const uuid = require('../lib/uuid')

const DB_STASH_INTERVAL = 10000
const AGED_OUT_DELTA = (1000*60*30)



// newer things use the repository bridge and store large objects via the repo bridge the JSON is just a meta object

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
    async remote_fetch_message(id,field) {          // expect no local object -- use universal id locator
        let m_path = this.default_m_path
        let msg = {
            "_id"  : id
        }
        if ( field !== undefined ) {
            msg.key_field = field
            msg[field] = id
        }
        let response = await this.messenger.get_on_path(msg,m_path)
        if ( response ) {
            if ( typeof response === 'object' ) {
                if ( response.msg ) return response.msg
                if ( response.status === "OK") {
                    let data = response.data
                    if ( typeof data === "string" ) {
                        try {
                            let obj = JSON.parse(data)
                            return obj
                        } catch (e) {}  // parse error
                    }
                    return response.data
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
    remote_store_message(obj,user_op) {
        if ( obj === undefined ) return
        if ( user_op ) obj._user_op = user_op
        let m_path = obj._m_path ? obj._m_path : this.default_m_path
        let msg = Object.assign({},obj)     // the message handling message might alter the object... leave the same locally
        this.messenger.set_on_path(msg,m_path)
    }


    /// tell systems that this processor has authority to remove the object in question 
    /// may turn to the repo bridge to unpin the object
    remote_store_dereference(id) {
        let m_path = this.default_m_path
        let msg = {
            "_id"  : id
        }
        this.messenger.del_on_path(msg,m_path)
    }

}




// LocalStorageLifeCycle 
//  ---- Time and identity

class LocalStorageLifeCycle extends RemoteMessaging {

    constructor(persistence_messenger,stash_interval,default_m_path) {
        super(persistence_messenger,default_m_path)

        this._storage_map = {}
        this._time_to_id = {}
        this._age_out_delta = AGED_OUT_DELTA
        
        this.stash_interval = stash_interval ? stash_interval : DB_STASH_INTERVAL
    }

    // 
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

    // local_db_store_map  -- a chrono method callback
    async local_db_store_map(storage_map) {
        try {
            fs.writeFile(this.db_file,JSON.stringify(storage_map),() => { this.dirty = false })
        } catch(e) {
        }
    }

    async local_db_load_map() {
        try {
            let store_map = JSON.parse(fs.readFileSync(this.db_file,'ascii').toString())
            return store_map
        } catch (e) {}
        return {}
    }

    // add_t_stamp -- for aging out data
    //
    add_t_stamp(tstamp,id) {
        if ( this._time_to_id[tstamp] == undefined ) {
            this._time_to_id[tstamp] = {}
        }
        this._time_to_id[tstamp][id] = 1
    }

    // object_add_t_stamp -- for aging out data
    //
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
    #_remove_stamp(tstamp,id) {
        let ids = this._time_to_id[tstamp]
        if ( ids !== undefined ) {
            delete this._time_to_id[tstamp][id]
        }
    }

    // update_stamp -- when data is touched make it newer
    update_stamp(tstamp,id) {
        this.#_remove_stamp(tstamp,id)
        let new_t = Date.now()
        this.add_t_stamp(new_t,id)
        return new_t
    }

    object_update_stamp(obj) {
        let tstamp = obj._tstamp
        let id = obj._id
        obj._tstamp = this.update_stamp(tstamp,id)
    }


    /// -----  OBJECT IDENTITY
    missing(obj) {
        let id = obj._id
        if ( this._storage_map[id] === undefined ) return true
        return false
    }

    id_maker() {
        return uuid()
    }

    hash_from_key(id) {
        let obj = this._storage_map[id]
        if ( obj ) {
            let hh = this.application_hash_key(obj)
            if ( hh ) return(hh)
        }
        return false
    }

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
        return false
    }
    
    //
    remove_from_storage_map(id) {
        if ( !(this._storage_map[id]) ) {
            return false
        }
        delete this._storage_map[id]
    }


    /// -----  OBJECT TIME in memory
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


//
class FilesAndRelays_base extends LocalStorageLifeCycle {
    //
    constructor(persistence_messenger,stash_interval,default_m_path) {
        super(persistence_messenger,stash_interval,default_m_path)
        this.root_path = require.main.path
        this.dirty = false
        this._search_attempted = false
    }

    initialize(conf) {
        // 
        if ( conf.persistence_db ) {   // just that some configurations may be passed in this fashion 
            conf = conf.persistence_db 
        }
        // Read previously locally stored records (default is users..) Build the storage map
        this.db_file = this.root_path + '/' + (conf.db_file ? conf.db_file : 'userdata.db')
        // 
        super.initialize(conf)
    }


    // remote_store - synchronizing the storage map with the remote DB interface
    // store many id's remotely  --- call to the messaging services
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

    #create(obj,do_remote) {  // only call from a failed search attempt
        //
        this.add_to_storage_map(obj)
        // the object in 'storage_map' is not going to keep lots of data around
        // the data is assumed to be in a remote machine (e.g. db server or other...)
        // sender is a copy (prefer local copy and tell the remote...)
        // application_stash_large_data -- returns a meta description of this object... 
        let sender = this.application_stash_large_data(obj)     // so make the app responsible for managing the large data
        this.remote_store_message(sender,'create')             // send it away, large data and all....    
        return true    
    }

    // findOne -- returns false if the object is nowhere...
    //      --- only the static descendant has to worry about dont_create
    async findOne(id,dont_create) {
        // check the storage map first....
        let obj = this._storage_map[id]
        if ( !( obj ) ) {
            obj = await this.remote_fetch_message(id)
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
    async search_one(key,field) {
        // don't check the stash
        let obj = await this.remote_fetch_message(key,field)
        if ( !( obj ) ) {
            return false
        }
        //
        this.application_fix_keys_obj(obj,key,field)
        let app_version = await this.application_large_data_from_stash(obj)
        return(app_version)
    }

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


    delete(id,dont_remote) {
        this.application_clear_large_data(this._storage_map[id])
        this.remove_from_storage_map(id)
        if ( !(dont_remote) ) this.remote_store_dereference(id)
        this.dirty = true
        return(false)
    }

    //
    all_keys() {
        return(Object.keys(this._storage_map))
    }

}


/// --- Application Customization --  hooks and handlers
/// Includes: data entry 

class ApplicationCustomizationMethods extends FilesAndRelays_base {

    constructor(persistence_messenger,stash_interval,default_m_path) {
        super(persistence_messenger,stash_interval,default_m_path)
    }

    // The pub/sub aspect of this data management interface allows subscription 
    // to a number of topics refered to as knowledge_domains. Knowledge domains are listed in an array on the configuration.
    // This initialization subscribes to a number of topcis and then passes the subscription response down to the 
    // application implementation
    initialize(conf) {
        //
        super.initialize(conf)
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


// EXPORT ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- 

// FilesAndRelays
//      ---- Expose the methods to the descendant modules here

class FilesAndRelays extends ApplicationCustomizationMethods {
    constructor(persistence_messenger,stash_interval,default_m_path) {
        super(persistence_messenger,stash_interval,default_m_path)
    }
}



module.exports = FilesAndRelays