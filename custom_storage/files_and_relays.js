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
        this._storage_map = {}
        this._time_to_id = {}
        this.dirty = false
        this.root_path = require.main.path
        this.stash_interval = stash_interval ? stash_interval : DB_STASH_INTERVAL
        this.count = 0
    }

    initialize(conf) {
        //
        // Subscribe to new information coming in on this local channel (default.. users)
        let topic = conf.knowledge_domain ? conf.knowledge_domain.topic : undefined
        if ( topic ) {
            this.messenger.subscribe(topic,{},(msg) => { this.app_subscription_handler(msg) })
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
        this.add_interval(extant_interval)
    }


    chrono_update_all() {
        this._time_to_id = {}
        for ( let id in this._storage_map ) {
            let tstamp = Date.now()
            this.add_t_stamp(tstamp,id)
            this._storage_map[id]._tstamp = tstamp
            this.count++
        }
    }
    
    
    prune_storage_map() {
        let ctime = Date.now()
        let stamps = Object.keys(this._time_to_id)
        stamps.sort()
        ctime -= AGED_OUT_DELTA
        while ( stamps.length > 0  ) {
            let ts = stamps.shift()
            if ( ctime > ts ) {
                let ids = this._time_to_id[ts]
                this.remote_store(ids)
                if ( Object.keys(ids) == 0 ) {
                    delete this._time_to_id[ts]
                }
            }
        }
    }

    
    add_t_stamp(tstamp,id) {
        if ( this._time_to_id[tstamp] == undefined ) {
            this._time_to_id[tstamp] = {}
        }
        this._time_to_id[tstamp][id] = 1
    }

    update_stamp(tstamp,id) {
        this.remove_stamp(tstamp,id)
        let new_t = Date.now()
        this.add_t_stamp(new_t,id)
        return new_t
    }

    remove_stamp(tstamp,id) {
        let ids = this._time_to_id[tstamp]
        if ( ids !== undefined ) {
            delete this._time_to_id[tstamp][id]
        }
    }



    
    app_shutdown() {
        fs.writeFileSync(this.db_file,JSON.stringify(this._storage_map))
    }



    async remote_fetch_message(id) {
        let m_type = obj.m_type ? obj.m_type : this.default_m_type
        let msg = {
            "m_type" : m_type,
            "el_id"  : id,
            "op"     : "G"
        }
        let obj = await this.messenger.send(msg)
        return obj
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


    remote_store(ids) {
        for ( let id in ids ) {
            let obj = this._storage_map[id]
            if ( this.remote_store_message(obj) ) {
                delete this._storage_map[id]
                delete ids[id]
            }
        }
    }


    create(obj) {
        if ( obj._id && this._storage_map[obj._id] ) {
            return new Error("already exists")
        }
        if ( !obj._id ) {
            obj._id = uuid()
        }
        this._storage_map[obj._id] = obj
        this.count++
        let tstamp = Date.now()
        this.add_t_stamp(tstamp,obj._id)
        obj._tstamp = tstamp
        this.remote_store_message(obj)
        return false
    }

    update(obj,dont_remote) {
        if ( !(obj._id) || !(this._storage_map[obj._id]) ) {
            return new Error("does not exists")
        }
        this._storage_map[obj._id] = obj
        obj._tstamp = this.update_stamp(obj._tstamp,obj._id)
        if ( !(dont_remote) ) this.remote_store_message(obj)
        this.dirty = true
        return(false)  // false is good
    }

    delete(id,dont_remote) {
        if ( !(this._storage_map[id]) ) {
            return false
        }
        let hh = this._storage_map[id]._key
        delete this._storage_map[id]
        if ( !(dont_remote) ) this.remote_store_dereference(id)
        this.dirty = true
        return(hh)  // false is good
    }

    async findOne(id,cb) {
        let obj = this._storage_map[id]
        if ( !( obj ) ) {
            obj = await this.remote_fetch_message(id)
            if ( !( obj ) && cb ) {
                cb(new Error("does not exists"),null)
                return false
            }
            this.create(obj,cb)
        }
        obj._tstamp = this.update_stamp(obj._tstamp,obj._id)
        if ( cb ) cb(null,obj)
        else return(obj)
        return(true)
    }

    all_keys() {
        return(Object.keys(this._storage_map))
    }

}



module.exports = FilesAndRelays