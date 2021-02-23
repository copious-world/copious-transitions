//
const AppLifeCycle = require('../lib/general_lifecyle')
const fs = require('fs')
const uuid = require('uuid/v4')

const DB_STASH_INTERVAL = 10000
const AGED_OUT_DELTA = (1000*60*30)

//
class FilesAndRelays extends AppLifeCycle {
    //
    constructor(persistence_messenger,stash_interval,default_m_type) {
        super()
        this.default_m_type = default_m_type ? default_m_type : 'persistence'
        this.messenger = persistence_messenger
        if ( this.messenger === undefined ) {
            throw new Error("Files and Relays -- must have a defined messenger -- cannot proceed without it.")
        }
        this._storage_map = {}
        this._time_to_id = {}
        this._age_out_delta = AGED_OUT_DELTA
        this.dirty = false
        this.root_path = require.main.path
        this.stash_interval = stash_interval ? stash_interval : DB_STASH_INTERVAL
        this.count = 0
        this._search_attempted = false
    }

    initialize(conf) {
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
        //
        // Read previously locally stored records (default is users..) Build the storage map
        this.db_file = this.root_path + '/' + (conf.db_file ? conf.db_file : 'userdata.db')
        try {
            this._storage_map  = JSON.parse(fs.readFileSync(this.db_file,'ascii').toString())
            this.chrono_update_all()
        } catch(e) {
            if ( e.code !== "ENOENT" ) {
                console.dir(e)
                process.exit(1)
            }
        }
        //
        //  PUT CURRENT DATA INTO A LOCAL FILE ON A PERIODIC BASIS
        let extant_interval = setInterval(() => {
            if ( this.dirty ) {
                this.prune_storage_map()
                fs.writeFile(this.db_file,JSON.stringify(this._storage_map),() => { this.dirty = false })
            }
        },this.stash_interval)
        //
        this._age_out_delta = (conf.persistence_aging ? parseInt(conf.persistence_aging) : this._age_out_delta)
        this.add_interval(extant_interval)
    }


    id_maker() {
        return uuid()
    }


    chrono_update_all() {   // usually called just in intialization ... starts the clock on each piece of data...
        this._time_to_id = {}
        for ( let id in this._storage_map ) {
            let tstamp = Date.now()
            this.add_t_stamp(tstamp,id)
            this._storage_map[id]._tstamp = tstamp
            this.count++
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
                this.remote_store(ids,prune)
                if ( Object.keys(ids) == 0 ) {
                    delete this._time_to_id[ts]
                }
            }
        }
    }

    
    // add_t_stamp -- for aging out data
    //
    add_t_stamp(tstamp,id) {
        if ( this._time_to_id[tstamp] == undefined ) {
            this._time_to_id[tstamp] = {}
        }
        this._time_to_id[tstamp][id] = 1
    }


    //
    _remove_stamp(tstamp,id) {
        let ids = this._time_to_id[tstamp]
        if ( ids !== undefined ) {
            delete this._time_to_id[tstamp][id]
        }
    }


    // update_stamp -- when data is touched make it newer
    update_stamp(tstamp,id) {
        this._remove_stamp(tstamp,id)
        let new_t = Date.now()
        this.add_t_stamp(new_t,id)
        return new_t
    }


    // called by application
    app_shutdown() {
        fs.writeFileSync(this.db_file,JSON.stringify(this._storage_map))
        this.shutdown()  //-- stops intervals,etc without a methods app_shutdown(), this does nothing to the running application
    }



    /// --- COMMUNICATION METHODS....

    async remote_fetch_message(id,field) {
        let m_type = this.default_m_type
        let msg = {
            "m_type" : m_type,
            "el_id"  : id,
            "op"     : "G"
        }
        if ( field !== undefined ) {
            msg.key_field = field
            msg[field] = id
        }
        let response = await this.messenger.send(msg)
        if ( response ) {
            return response
        }
        return(false)
    }

    remote_store_message(obj) {
        let m_type = obj.m_type ? obj.m_type : this.default_m_type
        let msg = Object.assign({},obj)
        msg.m_type = m_type
        msg.op = "S"
        this.messenger.send(msg)
    }

    remote_store_dereference(id) {
        let m_type = obj.m_type ? obj.m_type : this.default_m_type
        let msg = {
            "m_type" : m_type,
            "el_id"  : id,
            "op"     : "D"
        }
        this.messenger.send(msg)
    }

    // store many id's remotely
    remote_store(ids,prune) {
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

    create(obj) {
        // only proceed if there was an attempt to find the object 
        // through this particular class instance...
        if ( this._search_attempted ) {
            this._search_attempted = false
            if ( obj._id && this._storage_map[obj._id] ) {
                return new Error("already exists")
            }
            if ( !obj._id ) {
                obj._id = this.id_maker()
            }
            //
            this._storage_map[obj._id] = obj  // if there is a lot of data here, this is only a reference... fix it after sending...
            this.count++
            let tstamp = Date.now()
            this.add_t_stamp(tstamp,obj._id)
            obj._tstamp = tstamp
            this.dirty = true
            //
            // the object in 'storage_map' is not going to keep lots of data around
            // the data is assumed to be in a remote machine (e.g. db server or other...)
            let sender = this.application_stash_large_data(obj)     // so make the app responsible for managing the large data
            this.remote_store_message(sender)             // send it away, large data and all....
            return true    
        }
        return false
    }


    // findOne -- returns false if the object is nowhere...
    async findOne(id) {
        this._search_attempted = true
        let obj = this._storage_map[id]
        if ( !( obj ) ) {
            obj = await this.remote_fetch_message(id)
            if ( !( obj ) ) {
                return false
            }
            this.create(obj)   // remote data will be stashed before unstashing...
        }
        obj._tstamp = this.update_stamp(obj._tstamp,obj._id)
        let app_version = this.application_unstash_large_data(obj)
        this._search_attempted = false  // handled for this object
        return(app_version)
    }

    async search_one(key,field) {
        this._search_attempted = true
        let obj = await this.remote_fetch_message(key,field)
        if ( !( obj ) ) {
            return false
        }
        this.create(obj)   // remote data will be stashed before unstashing...
        obj._tstamp = this.update_stamp(obj._tstamp,obj._id)
        let app_version = this.application_unstash_large_data(obj)
        this._search_attempted = false  // handled for this object
        return(app_version)
    }


    update(obj,dont_remote) {
        if ( !(obj._id) || !(this._storage_map[obj._id]) ) {
            return new Error("does not exists")
        }
        this._storage_map[obj._id] = obj
        obj._tstamp = this.update_stamp(obj._tstamp,obj._id)
        if ( !(dont_remote) ) {
            let sender = this.application_unstash_large_data(obj)
            this.remote_store_message(sender)
        }
        this.application_stash_large_data(obj)
        this.dirty = true
        return(false)  // false is good
    }

    delete(id,dont_remote) {
        if ( !(this._storage_map[id]) ) {
            return false
        }
        delete this._storage_map[id]
        if ( !(dont_remote) ) this.remote_store_dereference(id)
        this.application_clear_large_data(this._storage_map[id])
        this.dirty = true
        return(false)
    }

    //
    all_keys() {
        return(Object.keys(this._storage_map))
    }


    /// --- Application SUSBSCRIPTION METHODS....
    app_subscription_handler(topic,msg) {
        console.warn("Files and Relays -- has no subscription handler for any topic")
    }

    application_stash_large_data(obj) { return obj }
    application_unstash_large_data(obj) { return obj }
    application_clear_large_data(obj) {}

}



module.exports = FilesAndRelays