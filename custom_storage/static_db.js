let FilesAndRelays = require('./files_and_relays')
let fsPromises = require('fs/promises')
const uuid = require('uuid/v4')
//

const MAX_LAX_CACHE_TIME = 1000*3600*4
const MAX_BYTES_ALLOWED = (1<<24)
const MAX_GROUP_STORAGE_SIZE = 256  // ??  The max length of data passed to the parent class, which will write all data to a file for restore
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
    constructor(messenger,stash_interval,default_m_type,whokey_field) {
        super(messenger,stash_interval,default_m_type)

        this._whokey_to_ids = {}
        this._ids_to_data_rep = {}

        this.max_freeloading_time = MAX_LAX_CACHE_TIME
        this.memory_allocation_preference = MAX_BYTES_ALLOWED
        this.allocated = 0
        this._whokey_field = whokey_field ? whokey_field : "email"
        this.back_up_on_delete = false
        this._adjusted_field_prefix = `_$_`
        this._max_group_storage = MAX_GROUP_STORAGE_SIZE
    }
    //
    initialize(conf) {
        super.initialize(conf)
        if ( conf.static_db ) {
            this.blob_dir = conf.static_db.blob_dir
            let freeloading_timeout = conf.static_db.freeloading_timeout
            this.max_freeloading_time =  freeloading_timeout ? freeloading_timeout : MAX_LAX_CACHE_TIME
            this.memory_allocation_preference = conf.static_db.max_data_RAM
            this._adjusted_field_prefix = conf.static_db.adjusted_field_prefix ? conf.static_db.adjusted_field_prefix : this._adjusted_field_prefix
            this._max_group_storage = conf.static_db.max_forwarded_storage ? conf.static_db.max_forwarded_storage : MAX_GROUP_STORAGE_SIZE
            this.load_dir(this.blob_dir)
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


    application_stash_large_data(obj) {
        let flat_object = this.flat_object(obj)
        if ( obj && (flat_object.length < this._max_group_storage) ) return(obj)  // no concern of this method
        //
        if ( obj._key !== undefined ) {  // in data reps table, _ids_to_data_rep
            let hh = obj._key
            let pmse = this._ids_to_data_rep[hh]
            pmse.update(obj,flat_object)
            return(pmse._obj)
        } else {
            let hh = this.hash(flat_object)
            if ( obj._id == undefined ) obj._id = this.id_maker()
            obj._key = hh
            let whokey = obj._whokey ? obj._whokey : ""
            let pmse = new PageableMemStoreElement(whokey,obj._id,obj,flat_object,this.back_up_on_delete)  // keep the big data here
            this._ids_to_data_rep[hh] = pmse
            return(pmse._obj)
        }
    }

    application_unstash_large_data(obj) {
        let hh = obj._key
        if ( hh !== undefined ) {  // in data reps table, _ids_to_data_rep
            let pmse = this._ids_to_data_rep[hh]
            if ( pmse.unhooked ) {
                (async (ff) => {
                    let str = await this.load_file(ff)
                    try {
                        let loaded_obj = JSON.parse(str)
                        pmse.update(loaded_obj)
                    } catch (e) {
                        console.log("PMSE - parse error...")
                    }
                })(pmse.file)
            }
            return(pmse._obj)
        }
        return(obj)
    }

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

    async set_key_value(whokey,data) {
        let id = this.has(whokey)
        if ( id !== false ) {
            let obj = await this.findOne(id)
            if ( obj ) {
                // set .. in this case is update
                if ( data._id ) delete data._id
                let up_obj = Object.assign(obj,data)
                obj._whokey = whokey
                this.update(up_obj)   // having found it still have to send new data back....
            }
        } else {  // never saw this
            let obj = await this.search_one(whokey,this._whokey_field)
            if ( obj ) {
                obj._whokey = whokey
                if ( data._id ) delete data._id
                let up_obj = Object.assign(obj,data)
                this.update(up_obj)   // having found it still have to send new data back....
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
            obj = await this.findOne(id)
        }
        this._whokey_to_ids[whokey] = obj._id  // by not setting the id, the parent class is allowed to set it
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
    }

    // 
    async remove_file(file) {
        if ( file !== undefined ) {
            try {
                let fpath = this.blob_dir + '/' + file
                await fsPromises.rm(fpath)
            } catch (e) {}
        }
    }

    async load_file(file) {
        if ( file !== undefined ) {
            try {
                let fpath = this.blob_dir + '/' + file
                let data = await fsPromises.readFile(fpath)
                let str = data.toString()
                return str
            } catch (e) {}
        }
    }

    async load_dir(blob_dir) {
        let files = await fsPromises.readdir(blob_dir)
        files.forEach(file => {
            try {
                let datstr = this.load_file(blob_dir + '/' + file)
                let datum = JSON.parse(datstr)
                let whokey = datum._whokey
                this.set_key_value(whokey,datum)
            } catch (e) {
            }
        });
    }

    schedule(sync_function,static_sync_interval) {  // sync_function this may go away, but it is here for now...
        if ( static_sync_interval ) {
            this.storage_interval = setInterval(() => { this.static_backup() })
        }
    }
    //


    async static_backup() {
        //this.unhooked = false
        for ( let ky in this._whokey_to_ids ) {
            let id = this._whokey_to_ids[ky]
            let pmse = this._ids_to_data_rep[id]
            if ( !(pmse.saved) ) {
                let datum = { ...(pmse.data) }
                datum.string = encodeURIComponent(datum.string)
                let file = this.blob_dir + '/' + pmse.file
                data._whokey = ky
                await fsPromises.writeFile(file,JSON.stringify(datum))
                this.saved = true
                // remove old data from memory if space is being used up.
                if ( (this.max_freeloading_time < (Date.now() - pmse.t_stamp))
                                    && (this.allocated > this.memory_allocation_preference) ) {
                    this.allocated -= pmse.data.string.length
                    pmse.data = null
                    pmse.unhooked = true
                }
            }
        }
    }

}


module.exports = StaticContracts