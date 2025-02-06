
const FilesAndRelays = require('./files_and_relays')
const fsPromises = require('fs/promises')
const fs = require('fs')
const uuid = () => {      // was uuid -- may change -- this instance is placed here for convenience (a module has been removed ... initialization order)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
     });
}
//

const MAX_LAX_CACHE_TIME = 1000*3600*4
const MAX_BYTES_ALLOWED = (1<<24)
const MAX_GROUP_STORAGE_SIZE = 256  // ??  The max length of data passed to the parent class, which will write all data to a file for restore
const DEFAULT_DB_DIR = "local/static_db"
//

/**
 * Some elements of the `_storage_map` are large enough that they should be stored on disk to keep RAM available.
 * A PageableMemStoreElement instance is used as a standin for the actual data record.
 * The total version of the object is to be placed in a file on disk. The larger fields are replaced in the object
 * with a descriptor. The resulting smaller object is allowed to stay in memory the PageableMemStoreElement instance
 * makes a reference to it via its `_obj` field. The PageableMemStoreElement instance retains information about the 
 * name of the file holding the complete object. 
 * 
 * As the object refered to by the PageableMemStoreElement instance is used, the complete object may or may not reside in memory.
 * The longer it is in memory without being used, the more likely the object will be reduced with the complete form being put out to 
 * disk. Several fields relate to the state of the objects storage and residence in memory.
 * 
 * * unhooked -- the object has been stashed during the syncing interval.
 * * saved -- true if the object data has been written to disk.
 * * flat_object -- the string form of the storage whose length determines if the PageableMemStoreElement is appropriate 
 * * file -- where the object will be stored, which is the name of the `_id` field, the wide are id.
 *
 * @memberof DefaultDB
 */
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


/**
 * 
 * This class handles the relationship between static storage and files on disk.
 * 
 * The object map will be stored at predefined intervals. And, some table entries will refer to larger data components 
 * that are better stored in files on disk.
 * 
 * This is a local storage implementation for those applications that do not supply their own in overriding 
 * the general DB methods given by the class DBClass nor by configuring a replacement for this class.
 * 
 * This class extends the FilesAndRelays class.
 * 
 *
 * @memberof DefaultDB
 */
class LocalStorageSerialization extends FilesAndRelays {


    constructor(messenger,stash_interval,default_m_path) {
        super(messenger,stash_interval,default_m_path)
        //
        this.blob_dir = false
    }

    /**
     * 
     * @param {object} conf 
     */
    initialize(conf) {
        super.initialize(conf)
        this.blob_dir = conf.blob_dir
        //
        if ( this.blob_dir ) {
            this.load_dir(this.blob_dir)
        }
    }

    /**
     * 
     * Synchronous file reading to a string
     * 
     * @param {string} file 
     * @returns {string|boolean} - returns the contents of the file as a string - false on failure
     */
    load_file(file) {
        if ( !(this.blob_dir) ) return;
        if ( file !== undefined ) {
            try {
                let fpath = this.blob_dir + '/' + file
                let data = fs.readFileSync(fpath)
                let str = data.toString()
                return str
            } catch (e) {
                console.log(e)
            }
        }
        return false
    }

    // 
    /**
     * Calls on the frameworks file removale method.  
     * @param {string} file 
     */
    async remove_file(file) {
        if ( !(this.blob_dir) ) return;
        if ( file !== undefined ) {
            try {
                let fpath = this.blob_dir + '/' + file
                await fsPromises.rm(fpath)
            } catch (e) {}
        }
    }


    /**
     * This method is called as part of initialization.
     * Take the name of the directory where the application will store blob data.
     * Reads each file in the directory.
     * 
     * Calls on `application_stash_large_data` to get the data's rerefence set up in memory.
     * @param {string} blob_dir 
     */
    load_dir(blob_dir) {
        if ( !(this.blob_dir) ) return;
        try {
            fs.mkdirSync(blob_dir)
        } catch (e) {
        }
        try {
            let files = fs.readdirSync(blob_dir)
            files.forEach(async file => {
                if ( file === '.DS_Store' ) return;
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
            console.log(e)
        }
    }


    /**
     * override pruning behavior
     * 
     * Usess `max_freeloading_time` instead of `_age_out_delta`  (???)
    */
    prune_storage_map() {
        let ctime = Date.now()
        let stamps = Object.keys(this._time_to_id)
        stamps.sort()
        ctime -= this.max_freeloading_time
        while ( stamps.length > 0  ) {
            let ts = stamps.shift()
            if ( ctime > ts ) {
                let ids = this._time_to_id[ts]
                this.remote_store_sync(ids)
                if ( Object.keys(ids) == 0 ) {
                    delete this._time_to_id[ts]
                }
            }
        }
    }


    /**
     * It is up to application subsclasses to make sure that the schedule method is called.
     * The interval is set to be `static_sync_interval`. At the interval, this calls `static_backup`
     * immediately after calling the callers `static_backup`.
     * 
     * @param {Function} sync_function 
     * @param {Number} static_sync_interval 
     */
    schedule(sync_function,static_sync_interval) {  // sync_function this may go away, but it is here for now...
        if ( static_sync_interval ) {
            this.storage_interval = setInterval(() => {
                if ( typeof sync_function === 'function' ) {
                    sync_function()
                }
                this.static_backup() 
            },static_sync_interval)
        }
    }
    //

    // static_backup
    //  write the larger data objects to a file.. one per object if it has not been saved
    //  
    /**
     * Write the current data tables out to files. 
     * If memory is getting tight, then objects that have been staying in memory too long are removed. 
     * (This is a very simple ... clumsy - implementation of an LRU)
     */
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

    /// FILES AND RELAYS - called by the wide area relationship

    /**
     * The main goal of this method is to create an instance of PageableMemStoreElement for the object or to
     * update it. It is called by the FilesAndRelays class when an object is created or when it is updated.
     * 
     * 
     * @param {object} obj 
     * @param {boolean} check_presistence 
     * @returns {object} - the object passed or the reference to its storage.
     */
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


    /**
     * Called locally. (would be protected in C++)
     * 
     * This loads data from a file if the pmse indicates that the data is no longer in memory.
     * The psme.update similar to deserialization method that will the state of the psme to indicate the state as 'datao loaded'
     * The term here is `hooked` and `unhooked`.
     * 
     * @param {object} pmse 
     * @returns {object} - the object managed by the psme (PageableMemStoreElement)
     */
    async _load_object_pmse(pmse) {
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

    /**
     * 
     * Part of getting a piece of data. Given are representation of the data is found, the key for the psme (PageableMemStoreElement)
     * is used to find information for loading the larger object from a file.
     * 
     * Called by the ancestor FilesAndRelays. In FilesAndRelays, this method is a nooperation.
     * It is assumed that the static DB will provide custom storage for certain types of obects.
     * 
     * 
     * @param {object} obj 
     * @returns {object} - the object managed by the psme (PageableMemStoreElement)
     */
    async application_large_data_from_stash(obj) {
        let hh = obj._key
        if ( hh !== undefined ) {  // in data reps table, _ids_to_data_rep
            let pmse = this._ids_to_data_rep[hh]
            if ( pmse === undefined ) return(obj)  // this is a problemc
            let loaded_obj = await this._load_object_pmse(pmse)
            loaded_obj._key = hh
            return loaded_obj
        }
        return(obj)
    }

    /**
     * This method is used in deleting a record.
     * 
     * Makes use of `_ids_to_data_rep` to fetch the psme (PageableMemStoreElement)
     * Calls the backup method of the for the psme and then deletes the reference from the table.
     * (Data may be retrieved from disk)
     * 
     * Called by the ancestor FilesAndRelays. In FilesAndRelays, this method is a nooperation.
     * It is assumed that the static DB will provide custom storage for certain types of obects.
     * 
     * @param {object} obj 
     * @returns {object} obj, which was passed in. But, it may be removed from the map holding PageableMemStoreElement instances
     */
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

    // the id should only be available if the object is known to the uniers...
    /**
     * 
     * @param {string} id 
     * @param {object} obj 
     * @param {object} data 
     */
    async load_missing_or_update(id,obj,data) {
        if ( data._id ) delete data._id     // remove the data id so as not to overwrite the object id
        let up_obj = Object.assign(obj,data)
        if ( super.missing(up_obj) ) {         // this means that the general mesh never saw it either (as far as local queries can make out)
            // so ask the mesh to find it (if at all possible)
            // this instead of super for application overrides
            let remote_obj = await this.findOne(id,true) // if we get a copy from the universe don't tell the universe that id never existed
            // so it showed up (but it's more up to date than the one stored here)
            if ( this.newer(remote_obj,up_obj) ) {
                up_obj = Object.assign(up_obj,remote_obj)           // let this be the one we know
            }
        }
        // make a space for it in local storage -- if there are changes the universe will be told
        this.update(up_obj)  // use the current object -- this call will make use of this static's application stashing 
    }


    /**
     * Called by the ancestor FilesAndRelays. In FilesAndRelays, this method is a nooperation.
     * It is assumed that the static DB will provide custom storage for certain types of obects.
     * 
     * 
     * @param {object} obj 
     * @param {string} key 
     * @param {string} field 
     */
    application_fix_keys_obj(obj,key,field,match_data) {  // `_id` `_key` `_whokey`
        if ( obj._whokey === undefined  ) {
            obj._whokey_field = key
            let id_chunk = obj[field]
            if ( id_chunk && id_chunk.length && (typeof id_chunk === 'string') ) {
                obj._whokey = id_chunk
            } 
            if ( obj._key === undefined ) {
                obj._key = this.hash(JSON.stringify(obj))
            }
            if ( obj._id === undefined ) {   // this should not happend (but as a stopgap)
                obj._id = match_data
            }
        }
    }

    
}

//
// and also a pub/sub client
//
/**
 * 
 * This is a local storage implementation for those applications that do not supply their own in overriding 
 * the general DB methods given by the class DBClass nor by configuring a replacement for this class.
 * 
 * This class extends FilesAndRelays which will attempt to port stored object out to an external DB, connected 
 * via the message service relay.
 * 
 * One property of this storage class is that data is updated by the last writer. There is no mechanism for consensus exposed
 * by this stack. Local copies can be inconsistent with remote entries. It is possible that an intermediary process can handle
 * consistency, or a derived class might handle consistency. Part of the reason for this state of affairs is that the code here
 * is provided for default usage of the Copious Transitions stack; it is not provided to solve a universal problem. Yet, it might 
 * provide some basic logic that can be used to interface with more universal architectures. 
 * 
 * On the other hand, there is a pub/sub mechanism that may be configured. And, a subclass of this class may implement `app_subscription_handler`. 
 * One possibility for the implementation of that method may be to take in copies of known entries and recitfy the differences when they arive
 * and also to put in new entries without much extra effort.
 * 
 * This implementation stores data, all entries, in a file and reloads it later. Large objects, those that can be sent through
 * communication channels without relying on special streaming or P2P architectures, are stored in their own files, but
 * a representation of the data, including the name of the file it is in, is stored in a PageableMemStoreElement element.
 * 
 * The handling of data persisted between runs is introduced by extending LocalStorageSerialization.
 * 
 * In this object storage, there is an assumption made about fields in the object. 
 * Object are expected to have or end up with about three different fields.
 * 
 * At least locally, the object will have a local identity or if not that some field indicating an owner of the object: `_whokey`
 * Another id would be a wide area id (or univsersal id): `_id`. It is expected that objects anywhere would be stored with such 
 * an id.  Then, the objects will have a hash (most likely a hash of the object data) stored in `_key`. 
 * 
 * This stack expects that globally the two keys `_id` and `_key` will be part of the object. And, this stack will add `_whokey` locally.
 * 
 * However, if the object cannot be found by those two keys, then this stack may search the wider area for the object using the local key
 * with the assumption that the local key is made up of some salient feature of the object. For example, it actaully might be the case 
 * that just one object is stored per owner, or perhaps `_whokey` and `_key` are the same universal hash. (It may be the case that all 
 * three fields are the same.)
 * 
 *
 * @memberof DefaultDB
 * 
 */
class LocalStaticDB extends LocalStorageSerialization {
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
    /**
     * Calls the initializer for FilesAndRelays and the immediate LocalStorageSerialization
     * 
     * @param {object} conf 
     */
    initialize(conf) {
        super.initialize(conf.static_db)
        if ( conf.static_db ) {
            //
            this._whokey_field = conf.static_db.index_key ? conf.static_db.index_key : this._whokey_field
            //
            let freeloading_timeout = conf.static_db.freeloading_timeout
            this.max_freeloading_time =  freeloading_timeout ? freeloading_timeout : MAX_LAX_CACHE_TIME
            this.memory_allocation_preference = conf.static_db.max_data_RAM
            this._max_group_storage = conf.static_db.max_forwarded_storage ? conf.static_db.max_forwarded_storage : MAX_GROUP_STORAGE_SIZE
        }
    }
    //
    /**
     * quite possibly another DB made fore keeping objects around for a long time will be used
     * @param {*} presistence_db 
     */
    setPersistence(presistence_db) {
        this.pdb = presistence_db       // application dependent :: quite possibly another DB made fore keeping objects around for a long time will be used.
    }

    /**
     * 
     * @param {string} whokey 
     * @returns {string|boolean} - returns fals if the elementis not in the `_whokey_to_ids` map. Otherwise, the id.
     */
    has(whokey) {
        let id = this._whokey_to_ids[whokey]
        return ( (id !== undefined) ? id : false )
    }

    /**
     * 
     * @param {string} data 
     * @returns {string} the hash of the data
     */
    hash(data) {
        let hh = Math.floor(Math.random()*data.length)   // not official left to the app
        return(hh)
    }

    /**
     * 
     * @param {object} remote_obj 
     * @param {object} up_obj 
     * @returns {boolean}
     */
    newer(remote_obj,up_obj) {
        return false        // application policy
    }
    
    /**
     * Add up all the fields values of an object that have a length field.
     * @param {object} obj 
     * @returns {Number} - object size
     */
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

    /**
     * Stringify the object -- some implementations might want to use some other method to turn an object into a packed array.
     * @param {object} obj 
     * @returns {string} - the stringified object
     */
    flat_object(obj) {
        return (JSON.stringify(obj))
    }


    field_transforms(ky) { return ky }  // for renaming fields if it is necessary (see descendants)


    /**
     * 
     * @param {object} obj 
     * @returns {string}  - value in a field `_key`, which is expected to be the hash of the data
     */
    application_hash_key(obj) {
        return obj._key
    }

    /**
     * Returns the intrinsic hash key
     * @param {object} obj 
     * @returns {string} - object hash
     */
    hash_from_persitence(obj) {
        let id = obj._id
        let hh = super.hash_from_key(id)
        return hh
    }

    /**
     * 
     * Searches for the id of the data object by using a local identity, 
     * where the id mapped by the whokey refers to a universal wide area identity of the data.
     * 
     * If it finds a local copy of the object, it will check to see if the local persistence storage keeps a copy.
     * Given there is a local copy, this method calls `get_key_value` primarily for loadging instances of PageableMemStoreElement
     * as it is already established the object exists.
     * 
     * If it does not find a local copy of the object, it will check to see if the larger world knows about it. Without a local copy,
     * the object `_id` cannot be known, so it searches for the object using the `whokey` using the field `_whokey_field`, which
     * is hopefully known universally. (It is expected the application has standardized some field and way of obtaining a universal
     * id for the objects stored here.) The search performed is the same as in `get_key_value`, however this method attempts to update
     * the object data. It calls `load_missing_or_update` to perform this operation.
     * 
     * Once the knowledge of the object is established, it will make sure the data is updated and synced with the local disk.
     * 
     * If the object has not been seen anywhere, this method will store it as a the definitive entry and send out to the wider area.
     * 
     * @param {string} whokey 
     * @param {object} data 
     * @returns {boolean}
     */
    async set_key_value(whokey,data) {
        //
        let wa_id = this.has(whokey)   // can we get the wide area id given the whokey
        //
        if ( wa_id !== false ) {           // we think we know about this object, but do we? Try to go from the key to having the object
            // look in all possible places to find this object
            let obj = await this.get_key_value(whokey)          // maybe it's stored locally (or it can be found with get)
            if ( !(obj) ) { obj = await this.findOne(wa_id) }   // so just try to find it somewhere on the mesh (should be known to the universe)
            if ( obj ) {            // can't be found at all
                // set .. in this case is update
                obj._whokey = whokey                // make records that this chunk of code can track
                // put data into the object and rectify with what is on disk.
                await this.load_missing_or_update(wa_id,obj,data)  // use LocalStorageSerialization and get the objects larger data
            }
        } else {  // never saw this (this node -- plugged into the copious-transitions relationship management)
            // so we go looking for it on the mesh
            //  -----------------search_one--------> using the *field* parameter
            let obj = await this.search_one(whokey,this._whokey_field,data[this._whokey_field])  // going to try to find an object with a local ownership field being used here
            if ( obj ) {        // there it is from the universe
                obj._whokey = whokey                    // the local identity will be stored with the object
                wa_id = delete data._id                 // get the wide area id 
                await this.load_missing_or_update(wa_id,obj,data)   // use LocalStorageSerialization and get the objects larger data
                //
            } else {        // OK -- don't have local record -- can't find it (very likey this node is the creator)
                obj = {
                    "key_field" : "file",
                    "file"  : uuid()
                }
                obj._whokey = whokey
                obj = Object.assign(obj,data)       // add the data being stored to the object (hence other keys)
                // CREATE
                this.update(obj,false,'create')     // store a persistence representation, but send any amount of data to the backend 
                                    //  -- this call will make use of this static's application stashing    
            }
            this._whokey_to_ids[whokey] = obj._id  // by not setting the id, the parent class is allowed to set it
            this._whokey_to_hash[whokey] = obj._key
        }
        return(true)
    }

    /**
     * Returns the object that can be found by the key.
     * 
     * Searches for the id of the data object by using a local identity, 
     * where the id mapped by the whokey refers to a universal wide area identity of the data.
     * 
     * If a local copy cannot be found it searches the wide area using the application defined field and the 
     * `whokey` as its value.
     * 
     * Otherwise, it finds one and tries to load its psme (PageableMemStoreElement). The object returned to the application will be 
     * stored with the psme. If the object is not large, it should be in the storage map, `_storage_map`. The method `findOne`
     * will return the object from `_storage_map` which is defined in the super class. Also, it `_storage_map` is out of sync,
     * then `findOne` will bring it back to sync (and take longer).
     * 
     * @param {string} whokey 
     * @returns {object} - the value stored
     */
    async get_key_value(whokey) {
        let id = this.has(whokey)
        let obj = null
        if ( !(id) ) {       // never saw this object (but someone seems to know its key)
            obj = await this.search_one(whokey,this._whokey_field)
        } else {
            let hh = this._whokey_to_hash[whokey]     // the object is here and known
            let pmse = this._ids_to_data_rep[hh]      // maybe load it.
            if ( pmse ) {
                let obj = pmse._obj
                if ( !obj ) {
                    let loaded_obj = await this._load_object_pmse(pmse)
                    if ( loaded_obj) {
                        return loaded_obj
                    }
                }
                return obj
            }
            obj = await this.findOne(id)  // by calling findOne, the object is pulled from `_storage_map`
        }
        if ( obj !== false ) {
            this._whokey_to_ids[whokey] = obj._id  // by not setting the id, the parent class is allowed to set it
            this._whokey_to_hash[whokey] = obj._key    
        }
        return obj
    }

    /**
     * 
     * Clear out the local knowledge of this object. Requests the wider area to forget the object.
     * Removes any files associated with the object.
     * 
     * The call to *delete* 
     * 
     * @param {string} whokey - named this to emphasize that this stack is usually used just for user objects.
     * @returns {boolean}
     */
    del_key_value(whokey) {
        let id = this.has(whokey)
        if ( !(id) ) return(false)  // never saw this object (but someone seems to know its key)

        // call files and relays delete, which will call out to remotes for delete, also it will clear the `_storage_map`.
        this.delete(id) // delete does not return a useful value
        let hh = this._whokey_to_hash[whokey]     // if the object is here and known
        if ( hh ) {                    // The key to larger storage
            let pmse = this._ids_to_data_rep[hh]    // it might be a large object
            if ( pmse ) {
                let local_data = pmse.data          // the stored data
                this.allocated -= local_data.string.length  // keep track of how much memory is being used up
                let file = pmse.file
                delete this._ids_to_data_rep[hh]            // remove the record of this file based data
                this.remove_file(file)                      // destroy the file containing the data
            }
        }
        delete this._whokey_to_ids[whokey]                  // remove other references
        delete this._whokey_to_hash[whokey]
        return true
    }


}


module.exports = LocalStaticDB