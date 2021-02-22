let FilesAndRelays = require('./files_and_relays')
let fsPromises = require('fs/promises')

const MAX_LAX_CACHE_TIME = 1000*3600*4
const MAX_BYTES_ALLOWED = (1<<24)
const MAX_GROUP_STORAGE_SIZE = 256  // ??  The max length of data passed to the parent class, which will write all data to a file for restore
//

class PageableMemStoreElement {
    constructor(key,file,type,data) {
        this.key = key
        this.file = file
        this.type = type
        this.data = data
        this.saved = false
        this.unhooked = false
        this.t_stamp = Date.now()
    }

    update(data) {
        this.data = data
        this.t_stamp = Date.now()
        this.saved = false
    }
}


function mime_to_file_type(mime_type) {
    return("json") // etc
}

//
// and also a pub/sub client
//
class StaticContracts extends FilesAndRelays {

    constructor(messenger,stash_interval,default_m_type) {
        super(messenger,stash_interval,default_m_type)

        this._whokey_to_ids = {}
        this._ids_to_data_rep = {}

        this.max_freeloading_time = MAX_LAX_CACHE_TIME
        this.memory_allocation_preference = MAX_BYTES_ALLOWED
        this.allocated = 0
    }
    //
    initialize(conf) {
        super.initialize(conf)
        if ( conf.static_db ) {
            this.blob_dir = conf.static_db.blob_dir
            let freeloading_timeout = conf.static_db.freeloading_timeout
            this.max_freeloading_time =  freeloading_timeout ? freeloading_timeout : MAX_LAX_CACHE_TIME
            this.memory_allocation_preference = conf.static_db.max_data_RAM
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
        let hh = ""
        return(hh)
    }

        
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


    remote_store_message(obj,m_type) {
        if ( obj._key !== undefined ) {
            let hh = obj._key 
            let pmse = this._ids_to_data_rep[hh]
            let sender = {}
            if ( pmse !== undefined ) {  // possibly needs to fetch from a local file....
                for ( let ky in obj ) { sender[ky] = obj[ky] }
                sender.data = pmse.data
            } else sender = obj
            super.remote_store_message(sender,m_type)
        } else {
            super.remote_store_message(obj,m_type)
        }
    }


    /*
        data == {
            'string' : text,
            'mime_type' : mime_type
        }
    */

    set_key_value(whokey,data) {
        let id = this.has(whokey)
        if ( id !== false ) {
            (async () => {
                let obj = await this.findOne(id)
                if ( obj ) {
                    let local_store = true
                    let hh = this.hash(data.string)
                    let stored = data.string
                    let len = data.string.length
                    if ( len < MAX_GROUP_STORAGE_SIZE ) {
                        stored = hh
                        local_store = false
                    }
                    obj.data = stored      // for recovery
                    // UPDATE
                    this.update(obj)
                    if ( local_store ) {
                        this.allocated += data.string.length
                        this._ids_to_data_rep[obj._key].update(data)
                    }
                }
            })()
        } else {
            let local_store = true
            let hh = this.hash(data.string)
            let stored = data.string
            let len = data.string.length
            if ( len < MAX_GROUP_STORAGE_SIZE ) {
                stored = hh
                local_store = false
            }
            let obj = {
                "_key" : (local_store ? hh : undefined),
                "data" : stored,
                "mime_type" : data.mime_type
            }
            // CREATE
            this.create(obj)
            this._whokey_to_ids[whokey] = obj._id  // by not setting the id, the parent class is allowed to set it
            let ftype = mime_to_file_type(data.mime_type)
            if ( local_store ) {
                this.allocated += data.string.length
                this._ids_to_data_rep[hh] = new PageableMemStoreElement(whokey,obj._id,ftype,data)
            }
        }
    }

    //
    async get_key_value(whokey) {
        let id = this._whokey_to_ids[whokey]
        if ( id === undefined ) return(false)
        let obj = await this.findOne(id)
        if ( obj !== false ) {
            if ( obj._key !== undefined ) {
                let hh = obj._key
                let pmse = this._ids_to_data_rep[hh]
                if ( pmse !== undefined ) {  // possibly needs to fetch from a local file....
                    if ( pmse.unhooked ) {
                        pmse.data.string = await this.load_file()
                        this.allocated += data.string.length
                        pmse.unhooked = false
                    }
                    return pmse.data
                }
            } else {
                // check on the data size....
                if ( obj.string && obj.string.length < MAX_GROUP_STORAGE_SIZE ) {
                    return(obj)
                } else {
                    let ftype = mime_to_file_type(obj.mime_type)
                    let local_data = {
                        "data" : obj.string,
                        "mime_type" : data.mime_type
                    }
                    this.allocated += local_data.string.length
                    let hh = this.hash(obj.string)
                    this._ids_to_data_rep[hh] = new PageableMemStoreElement(whokey,obj._id,ftype,local_data)
                    obj._key = hh
                    obj.data = hh
                    this.update(obj,true)  // true turns off remote storage, where this just came from
                    return local_data
                }
            }
        }
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
        let files = fsPromises.readdir(blob_dir)
        file.forEach(fille => {
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
                dataum.string = encodeURIComponent(dataum.string)
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