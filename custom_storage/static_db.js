let FilesAndRelays = require('./files_and_relays')
let fsPromises = require('fs/promises')
let fs = require('fs')
const uuid = require('uuid/v4')
//

const MAX_LAX_CACHE_TIME = 1000*3600*4
const MAX_BYTES_ALLOWED = (1<<24)
const MAX_GROUP_STORAGE_SIZE = 256  // ??  The max length of data passed to the parent class, which will write all data to a file for restore
const DEFAULT_DB_DIR = "local/static_db"
//

class PageableMemStoreElement {
    //
    constructor(key,file,obj,flat_obj,buod) {
        this.key = key
        this.file = file
        this.type = '.json'
        this._obj = Object.assign({},obj) 
        this.saved = false
        this.unhooked = false
        this.t_stamp = Date.now()
        this.back_up_on_delete = buod
        this.flat_object = flat_obj
        this.clip_big_fields(obj)
        this.blob_dir = DEFAULT_DB_DIR
    }

    update(obj,flat_obj) {
        this._obj = Object.assign({},obj) 
        this.clip_big_fields(obj)
        this.t_stamp = Date.now()
        this.unhooked = false
        this.saved = false
        this.flat_object = flat_obj
        this.clip_big_fields(obj)
    }

    back_up(deleting) {
        if ( deleting ) {
            if ( !(this.back_up_on_delete) ) return;
        }
        // write to a file.....
    }

    clip_big_fields(obj) {
        for ( let ky in obj ) {
            let val = obj[ky]
            if ( val.length > (MAX_GROUP_STORAGE_SIZE/4) ) {
                obj[ky] = `@${ky}`
            }
        }
    }
}


function mime_to_file_type(mime_type) {
    return("json") // etc
}

//
// and also a pub/sub client
//
class StaticContracts extends FilesAndRelays {
    //
    constructor(messenger,stash_interval,default_m_path,whokey_field) {
        super(messenger,stash_interval,default_m_path)

        this._whokey_to_ids = {}
        this._whokey_to_hash = {}
        this._ids_to_data_rep = {}

        this.max_freeloading_time = MAX_LAX_CACHE_TIME
        this.memory_allocation_preference = MAX_BYTES_ALLOWED
        this.allocated = 0
        this._whokey_field = whokey_field ? whokey_field : "email"
        this.back_up_on_delete = false
        this._max_group_storage = MAX_GROUP_STORAGE_SIZE
    }
    //
    initialize(conf) {
        super.initialize(conf.static_db)
        if ( conf.static_db ) {
            //
            this.blob_dir = conf.static_db.blob_dir
            let freeloading_timeout = conf.static_db.freeloading_timeout
            this.max_freeloading_time =  freeloading_timeout ? freeloading_timeout : MAX_LAX_CACHE_TIME
            this.memory_allocation_preference = conf.static_db.max_data_RAM
            this._max_group_storage = conf.static_db.max_forwarded_storage ? conf.static_db.max_forwarded_storage : MAX_GROUP_STORAGE_SIZE
            //
            if ( this.blob_dir ) {
                this.load_dir(this.blob_dir)
            }
        }
    }
    //
    setPersistence(presistence_db) {
        this.pdb = presistence_db
    }

    has(whokey) {
        let id = this._whokey_to_ids[whokey]
        return ( (id !== undefined) ? id : false )
    }

    hash(data) {
        let hh = Math.floor(Math.random()*data.length)   // not official left to the app
        return(hh)
    }

    newer(remote_obj,up_obj) {
        return false        // applicatio policy
    }

    flat_object_size(obj) {
        let sz = 0
        for ( let ky in obj ) {
            let dat = obj[ky]
            if ( dat.length ) {
                sz += dat.length
            }
        }
        return sz
    }

    flat_object(obj) {
        return (JSON.stringify(obj))
    }


    field_transforms(ky) { return ky }  // for renaming fields if it is necessary (see descendants)
        
    // override pruning behavior
    prune_storage_map() {
        let ctime = Date.now()
        let stamps = Object.keys(this._time_to_id)
        stamps.sort()
        ctime -= this.max_freeloading_time
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


    // // 
    application_fix_keys_obj(obj,key,field) {
        if ( obj._whokey === undefined  ) {
            obj._whokey = key
            let id_chunk = obj[field]
            if ( id_chunk && id_chunk.length && (typeof id_chunk === 'string') ) {
                if ( key.indexOf(id_chunk) < 0 ) {
                    obj._whokey += `_${id_chunk}`
                }
            } 
        }
    }

    application_hash_key(obj) {
        return obj._key
    }

    hash_from_persitence(obj) {
        let id = obj._id
        let hh = super.hash_from_key(id)
        return hh
    }

    // // 
    application_stash_large_data(obj,check_presistence) {
        let flat_object = this.flat_object(obj)
        if ( obj && (flat_object.length < this._max_group_storage) ) return(obj)  // no concern of this method
        //
        if ( obj._key !== undefined && !(check_presistence) ) {  // in data reps table, _ids_to_data_rep
            let hh = obj._key
            let pmse = this._ids_to_data_rep[hh]
            if ( pmse ) {
                pmse.update(obj,flat_object)
                return(pmse._obj)    
            } else return(obj)
        } else {
            let hh = false
            if ( check_presistence ) {
                hh = obj._key
            }
            if ( !(hh) ) {
                hh = ( obj._id !== undefined ) ? this.hash_from_persitence(obj) : this.hash(flat_object)
            }
            if ( !(hh) ) {
                hh = this.hash(flat_object)
            }
            if ( obj._id == undefined ) obj._id = this.id_maker()
            obj._key = hh
            let whokey = obj._whokey ? obj._whokey : "lost"
            obj._whokey = whokey
            this._whokey_to_ids[whokey] = obj._id
            this._whokey_to_hash[whokey] = obj._key
            let pmse = new PageableMemStoreElement(whokey,obj._id,obj,flat_object,this.back_up_on_delete)  // keep the big data here
            this._ids_to_data_rep[hh] = pmse
            return(pmse._obj)
        }
    }

    async load_object_pmse(pmse) {
        if ( pmse.unhooked ) {
            let str = await this.load_file(pmse.file)
            try {
                let loaded_obj = JSON.parse(str)
                pmse.update(loaded_obj)
            } catch (e) {
                console.log("PMSE - parse error...")
            }
        }
        return(pmse._obj)
    }

    // // 
    async application_unstash_large_data(obj) {
        let hh = obj._key
        if ( hh !== undefined ) {  // in data reps table, _ids_to_data_rep
            let pmse = this._ids_to_data_rep[hh]
            if ( pmse === undefined ) return(obj)  // this is a problemc
            let loaded_obj = await this.load_object_pmse(pmse)
            loaded_obj._key = hh
            return loaded_obj
        }
        return(obj)
    }

    // // 
    application_clear_large_data(obj) {
        let hh = obj._key
        if ( hh !== undefined ) {
            let pmse = this._ids_to_data_rep[hh]
            if ( pmse ) {
                pmse.back_up(true)
                delete this._ids_to_data_rep[hh]
            }
        } 
        return(obj)
    }

    // // 
    async set_key_value(whokey,data) {
        let id = this.has(whokey)
        if ( id !== false ) {
            let obj = await this.get_key_value(whokey)
            if ( !(obj) ) { obj = await this.findOne(id) }
            if ( obj ) {
                // set .. in this case is update
                obj._whokey = whokey
                if ( data._id ) delete data._id
                let up_obj = Object.assign(obj,data)
                if ( super.missing(obj) ) {
                    let remote_obj = await this.findOne(id,true)   /// tells it not to create, see next step
                    if ( this.newer(remote_obj,up_obj) ) {
                        up_obj = Object.assign(up_obj,remote_obj)
                    }
                    this.create(up_obj)  // use the current object
                } else {
                    this.update(up_obj)   // having found it still have to send new data back....
                }
            }
        } else {  // never saw this
            let obj = await this.search_one(whokey,this._whokey_field)
            if ( obj ) {
                obj._whokey = whokey
                if ( data._id ) delete data._id
                let up_obj = Object.assign(obj,data)
                if ( super.missing(obj) ) {     // see if persistence knows about this object...
                    await this.findOne(data._id,true)     // let remote_obj = if this returns a remote object, it could be checked
                    if ( this.newer(remote_obj,up_obj) ) {
                        up_obj = Object.assign(up_obj,remote_obj)
                    }
                    this.create(up_obj)  // use the current object, keep a copy in the persistence side of things...
                } else {
                    this.update(up_obj)   // having found it still have to send new data back.... (if no_remote, then update just stores the local copy)
                }
            } else {
                obj = {
                    "key_field" : "file",
                    "file"  : uuid()
                }
                obj._whokey = whokey
                obj = Object.assign(obj,data)                
                // CREATE
                this.create(obj)    // store a persistence representation, but send any amount of data to the backend    
            }
            this._whokey_to_ids[whokey] = obj._id  // by not setting the id, the parent class is allowed to set it
            this._whokey_to_hash[whokey] = obj._key
        }
        return(true)
    }

    //
    async get_key_value(whokey) {
        let id = this._whokey_to_ids[whokey]
        let obj = null
        if ( id === undefined ) {
            obj = await this.search_one(whokey,this._whokey_field)
        } else {
            let hh = this._whokey_to_hash[whokey]
            let pmse = this._ids_to_data_rep[hh]
            if ( pmse ) {
                let obj = pmse._obj
                if ( !obj ) {
                    let loaded_obj = await this.load_object_pmse(pmse)
                    if ( loaded_obj) {
                        return loaded_obj
                    }
                }
                return obj
            }
            obj = await this.findOne(id)
        }
        this._whokey_to_ids[whokey] = obj._id  // by not setting the id, the parent class is allowed to set it
        this._whokey_to_hash[whokey] = obj._key
        return obj
    }

    //
    del_key_value(whokey) {
        let id = this._whokey_to_ids[whokey]
        if ( id === undefined ) return(false)
        let hh = this.delete(id)
        if ( hh !== false) {
            let pmse = this._ids_to_data_rep[hh]
            let local_data = pmse.data
            this.allocated -= local_data.string.length
            let file = pmse.file
            delete this._ids_to_data_rep[hh]
            this.remove_file(file)
        }
        delete this._whokey_to_ids[whokey]
        delete this._whokey_to_hash[whokey]
    }

    // 
    async remove_file(file) {
        if ( this.blob_dir === undefined ) return;
        if ( file !== undefined ) {
            try {
                let fpath = this.blob_dir + '/' + file
                await fsPromises.rm(fpath)
            } catch (e) {}
        }
    }

    load_file(file) {
        if ( this.blob_dir === undefined ) return;
        if ( file !== undefined ) {
            try {
                let fpath = this.blob_dir + '/' + file
                let data = fs.readFileSync(fpath)
                let str = data.toString()
                return str
            } catch (e) {}
        }
        return false
    }

    // //
    load_dir(blob_dir) {
        if ( this.blob_dir === undefined ) return;
        try {
            fs.mkdirSync(blob_dir)
        } catch (e) {
        }
        try {
            let files = fs.readdirSync(blob_dir)
            files.forEach(async file => {
                if ( file === '.DS_Store' ) return
                try {
                    let datstr = this.load_file(file)
                    if ( datstr ) {
                        let obj = JSON.parse(datstr)
                        this.application_stash_large_data(obj,true)
                        // can't do this:: this.set_key_value(whokey,datum)    
                    }
                } catch (e) {
                }
            });            
        } catch (e) {
        }


    }

    schedule(sync_function,static_sync_interval) {  // sync_function this may go away, but it is here for now...
        if ( static_sync_interval ) {
            this.storage_interval = setInterval(() => { this.static_backup() },static_sync_interval)
        }
    }
    //

    // static_backup
    //  write the larger data objects to a file.. one per object if it has not been saved
    //  
    async static_backup() {
        if ( this.blob_dir === undefined ) return;
        //this.unhooked = false
        for ( let hh in this._ids_to_data_rep ) {
            let pmse = this._ids_to_data_rep[hh]
            if ( !(pmse.saved) ) {
                let string = pmse.flat_object
                let file = this.blob_dir + '/' + pmse.file
                await fsPromises.writeFile(file,string)
                this.saved = true
                // remove old data from memory if space is being used up.
                if ( this.ultra_test || ((this.max_freeloading_time < (Date.now() - pmse.t_stamp))
                                                        && (this.allocated > this.memory_allocation_preference)) ) {
                    this.allocated -= string.length
                    pmse._obj = null
                    pmse.unhooked = true
                }
            }
        }
    }

}


module.exports = StaticContracts