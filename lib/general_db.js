const AppLifeCycle = require("./general_lifecyle")

const { DefaultStaticDB, DefaultPersistenceDB, DefaultKeyValueDB, DefaultNoShareSessionTable } = require('../index')

const DEFAULT_STATIC_SYNC_INTERVAL = (1000*60*30)

/** 
 * This class provides a central point of reckonning for database interfaces. 
 * All modules that preform actions on behalf of the contractual modules have access to the application database interface. 
 * This class provides interfaes for different type of databases.
 * 
 * 
 * the idea of the different types of DBs
 * 1) The key value DB is an LRU in memory cache which has disk backup. Different kinds of data structures can be put there.
 *      -- If a value is out of cache, it can be retrieved from disk. Used in song-search db. Stores files as the value.
 *      -- Also, it retrieves files from disk at startup and stores them into the in-memory table. (A shim for something like 
 *      -- Redis might be used.)
 * 2) The session_key_value_db -- this is for taking in and validating sessions in particular. It might be useful for other 
 *      -- data collection purposes. This is in-memory records, specifically within an LRU. There is no disk backup. But,
 *      -- there is redundancy on secondary machines which will hold sessions for longer periods of time and age them out
 *      -- gracefully unless they are accessed.
 * 3) the pdb - a persistence database is a database that promises to maintain a record with some permanence. It is fronted by 
 *      -- a key value db with ephemeral properties. But, it can be assumed that the records will be written early in the life of 
 *      -- a data object. Aging out of the LRU quickly can be expected. And, the data location can be expected to be on a seconday 
 *      -- machine. (User records -- for customer stats, etc. may be stored here)
 * 4) the sdb - a static data base. The static db is expected to be fairly similar to a persistence DB, except that it offers the 
 *      -- guarantee that the data items are stored on a disk local to the process which accesses the code. (This is mostly used to 
 *      -- create a set of static assets for serving to web sessions. Ideally, the sort of caching available to nginx or other
 *      -- web servers might be served by this sort of store.) It is expected that the store will be loaded when the database service 
 *      -- starts for the general case. (The general case handles as much logic as it can.)
 *
 * Note: both the persistence DB and the static DB will default to using the DB provided by `default_persistent_db` if these are not
 * configured or passed into the constructor.
 * 
 * NOTE: all the base classes in /lib return the class and do not return an instance. Explore the applications and 
 * the reader will find that the descendant modules export instances. The classes provided by copious-transitions must
 * be extended by an application.
 * 
 * @memberof base
 */

class GeneralDBWrapperImpl extends AppLifeCycle {
    //
    constructor(keyValueDB,sessionKeyValueDB,persistentDB,staticDB) {
        //
        super()
        //
        this.hasher = (typeof global_hasher === 'function') ? global_hasher : (key) => { return key }
        //
        // EPHEMERAL (in memory will be erased when the application turns off.. BUT -- may be replicated on nodes with checkpoint writes)
        //
        if ( !keyValueDB ) {     // MEMORY BASED (SHARED MEM) but with with likely backup (size less determined)
            this.key_value_db = new DefaultKeyValueDB()
        } else {
            this.key_value_db = keyValueDB
        }
        //
        if ( !sessionKeyValueDB ) {     // MEMORY BASED (SHARED MEM) but with with likely backup (size less determined)
            this.session_key_value_db = new DefaultNoShareSessionTable()
        } else {
            this.session_key_value_db = sessionKeyValueDB
        }
        //
        // CACHEABLE (WILL WRITE TO DISK SOMEWHERE)
        if ( !(persistentDB) ) {    // DISK within LOCAL and PEER NODES
            this.pdb = new DefaultPersistenceDB()
        } else {
            this.pdb = persistentDB
        }
        //
        if ( !(staticDB) ) {        // LOCAL ON DISK (LOCAL CACHE AND STARTUP CACHE)
            this.sdb = new DefaultStaticDB()
        } else {
            this.sdb = staticDB
        }
        // DB's that use persistence after some time, for logging, for benchmarking
        if ( this.sdb && (typeof this.sdb.setPersistence === 'function ') ) {
            this.sdb.setPersistence(this.pdb)
        }
        if ( this.key_value_db && (typeof this.key_value_db.setPersistence === 'function ') ) {
            this.key_value_db.setPersistence(this.pdb)
        }
    }

    /**
     * Calls the initialization methods for all the connection based databases interfaces.
     * This includes the `key_value_db`, the persistent db (pdb), and the static db (sdb).
     * The `static_sync` interval is read from the configuration.
     * 
     * @param {object} conf 
     */
    initialize(conf) {
        if ( conf === undefined || conf.db === undefined ) {
            throw new Error("data base initialization ... configuration not providded")
        }
        this.key_value_db.initialize(conf.db.key_value_db)
        if ( this.session_key_value_db !== this.key_value_db ) {
            this.session_key_value_db.initialize(conf.db.session_key_value_db)
        }
        this.pdb.initialize(conf.db.persistence_db)           // initialize persitence...relative to the database
        this.sdb.initialize(conf.db.static_db)
        this.static_sync_interval = conf.db.static_sync ? conf.db.static_sync : DEFAULT_STATIC_SYNC_INTERVAL
    }

    /**
     * The method `last_step_initalization` exists in order to give make a call available to the initialization process 
     * in the `user_service_class` module.  This method is called at the start of `run`.
     */
    last_step_initalization() { }
    //


    /**
     * If the hasher is not set during construction, 
     * then the application may use this method to set the has function for use by the db.
     * @param {*} hashfn 
     */
    set_hasher(hashfn) {
        this.hasher = hashfn
    }


    /// DATABASE CONNECTION UPDATES (ADDITIONS, SHUTDOWN, NEW SERVICES)

    /**
     * change_key_value_db_instance
     * @param {Object} new_kv_db - a key value database connector instance (may be an internal memory table client)
     * @param {Object} conf -- a configurations for the key value database connector
     */
    async change_key_value_db_instance(new_kv_db,conf) {
        if ( this.key_value_db ) {
            conf._db_closing = true
            await this.this.key_value_db.close_connection(conf)  // conf is passed for those types that keep a number of connections opend
        }
        this.key_value_db = new_kv_db
        await this.key_value_db.initialize(conf)
    }

    /**
     * add_key_value_db_connection
     * @param {Object} conf -- a configurations for the key value db connections
     */
    async add_key_value_db_connection(conf) {
        if ( this.key_value_db && (this.key_value_db.add_connection === 'function') ) {
            await this.key_value_db.add_connection(conf)
        }
    }

    /**
     * remove_key_value_db_connection
     * @param {Object} conf -- a configurations for the key value db connections
     */
    async remove_key_value_db_connection(conf) {
        if ( this.key_value_db && (this.key_value_db.close_connection === 'function') ) {
            await this.key_value_db.close_connection(conf)
        }
    }



    /**
     * change_session_key_value_db_instance
     * @param {Object} new_kv_db - a key value database connector instance (may be an internal memory table client)
     * @param {Object} conf -- a configurations for the key value database connector
     */
    async change_session_key_value_db_instance(new_session_db,conf) {
        if ( this.key_value_db ) {
            conf._db_closing = true
            await this.session_key_value_db.close_connection(conf)  // conf is passed for those types that keep a number of connections opend
        }
        this.session_key_value_db = new_session_db
        await this.session_key_value_db.initialize(conf)
    }

    /**
     * add_session_key_value_db_connection
     * @param {Object} conf -- a configurations for the key value db connections
     */
    async add_session_key_value_db_connection(conf) {
        if ( this.session_key_value_db && (this.session_key_value_db.add_connection === 'function') ) {
            await this.session_key_value_db.add_connection(conf)
        }
    }

    /**
     * remove_session_key_value_db_connection
     * @param {Object} conf -- a configurations for the key value db connections
     */
    async remove_session_key_value_db_connection(conf) {
        if ( this.session_key_value_db && (this.session_key_value_db.close_connection === 'function') ) {
            conf._db_closing = true
            await this.session_key_value_db.close_connection(conf)
        }
    }



    /**
     * change_static_db_instance
     * @param {Object} new_kv_db - a key value database connector instance (may be an internal memory table client)
     * @param {Object} conf -- a configurations for the key value database connector
     */
    async change_static_db_instance(new_static_db,conf) {
        if ( this.sdb ) {
            conf._db_closing = true
            await this.sdb.close_connection(conf)  // conf is passed for those types that keep a number of connections opend
        }
        this.sdb = new_static_db
        await this.sdb.initialize(conf)
    }

    /**
     * add_static_db_connection
     * @param {Object} conf -- a configurations for the key value db connections
     */
    async add_static_db_connection(conf) {
        if ( this.sdb && (this.sdb.add_connection === 'function') ) {
            await this.sdb.add_connection(conf)
        }
    }

    /**
     * remove_static_db_connection
     * @param {Object} conf -- a configurations for the key value db connections
     */
    async remove_static_db_connection(conf) {
        if ( this.sdb && (this.sdb.close_connection === 'function') ) {
            conf._db_closing = true
            await this.sdb.close_connection(conf)
        }
    }


    /**
     * change_persistence_db_instance
     * @param {Object} new_kv_db - a key value database connector instance (may be an internal memory table client)
     * @param {Object} conf -- a configurations for the key value database connector
     */
    async change_persistence_db_instance(new_persistence_db,conf) {
        if ( this.pdb ) {
            conf._db_closing = true
            await this.pdb.close_connection(conf)  // conf is passed for those types that keep a number of connections opend
        }
        this.pdb = new_persistence_db
        await this.pdb.initialize(conf)
    }

    /**
     * add_persistence_db_connection
     * @param {Object} conf -- a configurations for the key value db connections
     */
    async add_persistence_db_connection(conf) {
        if ( this.pdb && (this.pdb.add_connection === 'function') ) {
            await this.pdb.add_connection(conf)
        }
    }

    /**
     * remove_persistence_db_connection
     * @param {Object} conf -- a configurations for the key value db connections
     */
    async remove_persistence_db_connection(conf) {
        if ( this.pdb && (this.pdb.close_connection === 'function') ) {
            conf._db_closing = true
            await this.pdb.close_connection(conf)
        }
    }



    /// END DATABASE CONNECTION UPDATES (ADDITIONS, SHUTDOWN, NEW SERVICES)
    

    //  KEY VALUE cache like DB in memory.  e.g. an interface to shm-lru-cache 
    /**
     * Insert or update in the key value DB
     * @param {string} key 
     * @param {object} value - 
     */
    async set_key_value(key,value) {    // notice this is set (the actual value is stored)
        await this.key_value_db.set(key,value)
    }

    //
    /**
     * delete from the key value DB
     * @param {string} token 
     */
    async del_key_value(token) {
        await this.key_value_db.delete(token)
    }

    //
    /**
     * return the value mapped by the key in the DB. 
     * retun null if the value is not present.
     * 
     * @param {string} key - key mapping to the object
     * @returns {any}
     */
    async get_key_value(key) {
        try {
            let value = await this.key_value_db.get(key)
            return value    
        } catch (e) {
            console.log(e)
            return null
        }
    }



    // --- SESSION --- 
    /**
     * The session storage.
     * Most likely the session storage will be implemented as a shared hash table. 
     * Some implementations may user share memory storage. And, some may use DHT (distributed hash tables).
     * 
     * @param {string} key 
     * @param {object} value 
     * @returns {string} - the hash key for the value.
     */
    async set_session_key_value(key,value) {   // notice this is a hash set (a speedy check)
        return await this.session_key_value_db.hash_set(key,value)
    }

    //
    /**
     * Remove the key from the hash table and free up space.
     * 
     * @param {string} key 
     */
    async del_session_key_value(key) {
        await this.session_key_value_db.delete(key)
    }

    //
    /**
     * Get the value from the hash table. 
     * The value mapped by the key is often a JSON object. If so, it should be parsed before it is returned.
     * 
     * @param {string} key 
     * @returns {any} The value mapped by the key
     */
    async get_session_key_value(key) {
        try {
            let value = await this.session_key_value_db.get(key)
            return value    
        } catch (e) {
            console.log(e)
            return null
        }  
    }


    /**
     * check_hash
     * 
     * It is expected that the set method produces a hash, 
     * and that there is a function that can reproduce the storage key 
     * such that the value stored by `set` can be obtained by the reproduced key.
     * 
     * Note: this method would be best used for tables mapping short string to short strings.
     * 
     * // this.session_key_value_db.hash_set(key,value)  was session_token -> ownership_key
     * 
     * @param {string} hh_invertable 
     * @param {string} ownership_key 
     * @returns {Boolean} true if the match can be reproduced.
     */

    async check_hash(hh_invertable, value) {
        if ( (typeof this.session_key_value_db.hash_invert) === 'function' ) {
            let truth = await this.session_key_value_db.hash_invert(hh_invertable, value)
            return truth
        }
        return false
    }


    
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    //
    /**
     * This method is for fecthing the description of fields that may occur in client forms.
     * This method is called by the method used to configure the validator.
     * 
     * @param {string} fields_key 
     * @returns {object}
     */
    async fetch_fields(fields_key) {
        // 
        let fields = {}
        if ( fields_key ) {
            let fields = await this.fetch(fields_key)
            if ( (typeof fields) === 'string' ) {
                fields = JSON.parse(fields)
            }   
        }
        return(fields)
    }

    //
    /**
     * This may be an implementation of get for one of the DB types. But, it may have other properties.
     * This is left as an abstract entry point for an application to define.
     * 
     * @param {string} key 
     * @returns {object}
     */
    fetch(key) {  // should be written by descendant
        let data = ""
        return(data)
    }

    //
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    /**
     * Get an object from static store
     * @param {string} asset 
     * @returns {object} -- the stored object
     */
    async static_store(asset) {  // for small size objects depending on the initialization parameters of the cache DB
        let data = ""
        if ( asset ) {
            try {
                data = await this.sdb.get_key_value(asset)
                if ( data ) {
                    return(JSON.parse(data))
                }
            } catch(e) {
            }
        }
        return(data)
    }

  
    /**
     * put the object in the static db, which attempts to keep a copy of the asset close to the processor on its own local disks...
     * 
     * wrap the object in a carrier, in which the object is serialized with its mime-type for future transport..
     * 
     * 
     * @param {string} whokey 
     * @param {string} text 
     * @param {string} mime_type 
     * @param {string} extension 
     * @returns {boolean}
     */
    async put_static_store(whokey,text,mime_type,extension) {
        if ( (typeof text)  !== 'string' ) {
            text = JSON.stringify(text)
        }
        if ( this.sdb === undefined ) return
        let data = {
            'string' : text,
            'mime_type' : mime_type
        }
        if ( extension && ( typeof extension === 'object' ) ) {
            // don't overwrite the fields this storage is about.
            if ( extension.string !== undefined ) delete extension.string
            if ( extension.mime_type !== undefined  ) delete extension.mime_type
            data = Object.assign(data,extension)
        }
        await this.sdb.set_key_value(whokey,data)
    }

    /**
     * 
     * @param {string} whokey 
     */
    async del_static_store(whokey) {
        if ( this.sdb === undefined ) return
        await this.sdb.del_key_value(whokey)
    }

    /**
     * 
     * @param {Function} sync_function 
     */
    static_synchronizer(sync_function) {
        if ( this.sdb === undefined ) return
        if ( this.sdb.schedule === undefined ) return
        this.sdb.schedule(sync_function,this.static_sync_interval)
    }




    //  CACHE
    //  ----  ----  ----  ----  ----  ----  ----  ----  ----
    // May use a backref 

    /**
     * 
     * @param {string} key 
     * @param {object} data 
     * @param {string} back_ref 
     */
    async store_cache(key,data,back_ref) {        // make use of the application chosen key-value implementation...
        //
        let ref = back_ref ? data[back_ref] : false;
        if ( ref ) {
            let ehash = this.hasher(key)
            await this.set_key_value(ref,ehash)
            await this.set_key_value(ehash,data)
        } else {
            //
            await this.set_key_value(key,data)
            //
        }
    }


    /**
     * 
     * @param {string} key 
     * @param {object} body 
     * @returns {object}
     */
    async cache_stored(key,body) {
        let ehash = this.hasher(key)
        try {
            let data = await this.get_key_value(ehash)
            if ( data ) {
                if ( (typeof data) === 'string' ) {
                    return JSON.parse(data)
                }
                return data
            } else return body
        } catch(e) {
            return body
        }
    }


    /**
     * 
     * @param {string} key 
     * @param {object} data 
     * @param {string} back_ref 
     */
    async update_cache(key,data,back_ref) {
        if ( typeof data !== 'string' ) {
            data = JSON.stringify(data)
        }
        let ref = back_ref ? data[back_ref] : false;
        if ( ref ) {
            let ehash = this.get_key_value(ref)
            if ( ehash !== false ) {
                await this.set_key_value(ehash,data)
            }
        } else {
            //
            await this.set_key_value(key,JSON.stringify(data))
            //
        }
    }
    
    //  ----  ----  ----  ----  ----  ----  ----  ----  ----
    //
    // in subclass 
    //
    /**
     * which_db
     * 
     * determines the storage table of a non-ephemeral database.
     * 
     * Tne collecion based operations assume that the persistence DB is DB server interface.
     * The method will check to see if the `collection` parameter can be parsed to idenitify the static DB.
     * These methods do not apply to th key-value DB. This choice is made since th key-value DB's may store
     * larger data structures and search within those structures. (see the connection tool for command options
     * that run these methods)
     * 
     * @param {object} collection - A table that will eventually contain the item
     */

    which_db(collection) {
        let db = this.pdb
        //
        if ( collection.indexOf('.') > 0 ) {
            let [db_type,table] = collection.split('.')
            if ( (db_type === 'static') || (db_type === 'local') ) {
                db = this.sdb
                collection = table
            }
        }
        return [db,collection]
    }

    /**
     * store
     * 
     * A wrapper for putting data into a table
     * 
     * @param {object} collection - A table that will eventually contain the item
     * @param {object} data  - any data that might be used by a method for inserting an entry or the data to be stored
     */
    async store(collection,data) {
        let [db,table] = this.which_db(collection)
        if ( db && table ) {
            if ( typeof db.store === 'function' ){
                return await db.store(table,data)
            }
        }
        return false
    }
    //
    /**
     * 
     * A method for checking the existence of some object in a DB table.
     * 
     * @param {object} collection - A table that will containing the item to be found
     * @param {object} data  - any data that might be used by a method for searching for an entry
     * @returns {boolean}
     */
    async exists(collection,data) {
        let query_components = data
        let [db,table] = this.which_db(collection)
        if ( db && table ) {
            if ( typeof db.query_id === 'function' ){
                return await db.query_id(table,query_components)
            }
        }
        return false
    }
    //
    /**
     * query
     * 
     * A method for running a query in a DB table and return some number of objects
     * 
     * @param {object} collection - A table that will containing the item to be found
     * @param {object} data  - any data that might be used by a method for searching for an entry
     * @returns {boolean|object}  false if boolean, otherwise the results of the query
     */
    async query(collection,data) {
        let query_components = data
        let [db,table] = this.which_db(collection)
        if ( db && table ) {
            if ( typeof db.query === 'function' ){
                return await db.query(table,query_components)
            }
        }
        return false
    }
    //
    /**
     * remove
     * 
     * Remove from a non-ephemeral DB table `collection`, those itemes matching fields provided by `data`
     * 
     * @param {object} collection - A table that will containing the item to be removed
     * @param {object} data  - any data that might be used by a method removing an entry
     */
    async remove(collection,data) {
        let [db,table] = this.which_db(collection)
        if ( db && table ) {
            if ( typeof db.delete_matches === 'function' ){
                return await db.delete_matches(table,data)
            }
        }
        return false
    }
    //
    /**
     * drop
     * 
     * This is a method for wrapping `drop` usually associated with a DB for dropping a table.
     * The collection is some object (perhaps a string) identifying the object to be dropped.
     * 
     * @param {object} collection - A table that will be dropped
     * @param {object} data  - any data that might be used by a method dropping a DB table.
     */
    async drop(collection,data) {
        let [db,table] = this.which_db(collection)
        if ( db && table ) {
            if ( typeof db.delete_matches === 'function' ){
                return await db.drop_table(table,data)
            }
        }
        return false
    }   // drop the database connection 

    //
    /**
     * This method is made available for applications that will clean up database connections on shutdown
     * or at various other times. This method defers disconnect to disconnect methods in the user DBs.
     * Each type of DB should implement a disconnect method.
     * 
     * @returns {boolean} - the extending class should override when processes must run before disconnnect
     */
    async disconnect() {
        //
        if ( this.key_value_db ) {
            if ( typeof this.key_value_db.disconnect === 'function' ) {
                await this.key_value_db.disconnect()
            }
        }
        //
        if ( this.session_key_value_db ) {
            if ( typeof this.session_key_value_db.disconnect === 'function' ) {
                await this.session_key_value_db.disconnect()
            }
        }
        //
        if ( this.pdb ) {
            if ( typeof this.pdb.disconnect === 'function' ) {
                await this.pdb.disconnect()
            }
        }
        //
        if ( this.sdb ) {
            if ( typeof this.sdb.disconnect === 'function' ) {
                await this.sdb.disconnect()
            }
        }
        //
        return(true)
    }
}




/**
 * 
 * USER METHODS default implementations
 * 
 * This class adds methods that deal directly with possible user storage and lookup tables.
 * The methods defined in the class are used by the class GeneralAuth found in `general_auth.js` in particular.
 * 
 * The default behavior is for the user to be stored in the persistence DB, which is most likely to be 
 * implemented by a connection to a DB service.  Except there is one method `fetch_user_from_key_value_store` 
 * that is used to get user information from the key-value DB, which is expected to be faster (in local memory).
 * 
 * Some applcations may want to override this class in order to change the kind of user table storage arrangement from
 * what is provided here. Even without the override, the constuctor expects that objects linking to external databases to be parameters.
 * 
 * Within the user methods, the user object, `u_data` (often) is expected to have an identity field, `_id`.
 * 
 */
class GeneralUserDBWrapperImpl extends GeneralDBWrapperImpl {

    constructor(keyValueDB,sessionKeyValueDB,persistentDB,staticDB) {
        super(keyValueDB,sessionKeyValueDB,persistentDB,staticDB)
    }


    /**
     * seeking_endpoint_paths  
     * 
     * Included for special cases
     * @returns Array
     */
    seeking_endpoint_paths() {
        return []
    }

    /**
     * set_messenger
     * 
     * @param {string} path 
     * @param {object} messenger -- communication object
     */
    set_messenger(path,messenger) {
    }

    /**
     * 
     * Some applications may elect to store user in the KV store. 
     * That is not the default behavior. The default behavior is to store the user in the persistence DB.
     * 
     * @param {string} key 
     * @returns {object|boolean}  - returns false on failing to find an object
     */
    async fetch_user_from_key_value_store(key) {
        if ( key == undefined ) return(false);
        try {
            let ehash = await this.get_key_value(key)
            if ( ehash === null || ehash === false ) {
                return(false)
            }
            if ( isHex(ehash) ) {   // or other format
                try {
                    let u_data = await this.get_key_value(ehash)
                    if ( u_data ) {
                        if ( (typeof data) === 'string' ) {
                            return JSON.parse(data)
                        }        
                        return data
                    }
                    return false
                } catch (e) {
                    return false
                }    
            } else {
                try {
                    let data = ehash        // user data
                    if ( (typeof data) === 'string' ) {
                        return JSON.parse(data)
                    }        
                    return data
                } catch (e) {
                    return false
                }
            }
        } catch(e) {
            return false
        }
    }

    /**
     * This is supplied to provide the parenthetical to the method `fetch_user_from_key_value_store`
     * @param {string} key 
     * @param {object} u_data 
     * @returns {boolean} - false on error
     */
    async put_user_into_key_value_store(key,u_data,ehash) {
        if ( key == undefined ) return(false);
        try {
            if ( ehash !== undefined ) {
                await this.set_key_value(key,ehash)
                if ( typeof u_data !== 'string' ) {
                    u_data = JSON.stringify(u_data)
                }
                await this.set_key_value(ehash,u_data)
                return true
            } else {
                if ( typeof u_data !== 'string' ) {
                    u_data = JSON.stringify(u_data)
                }
                await this.set_key_value(ehash,u_data)
                return true
            }
        } catch(e) {
            return false
        }
    }

    
    /**
     * 
     * @param {string} user_txt 
     * @returns {string} an unique id for a stored object
     */
    id_hashing(user_txt) {
        let id = this.hasher(user_txt)  // or this.oracular_storage()
        return id
    }

    // store_user
    // // just work with the presistent DB
    /**
     * 
     * @param {object} u_data 
     * @param {string} key 
     * @param {Function} cb 
     * @returns {string} an unique id for a stored object
     */
    async store_user(u_data,key,cb) { // up to the application...(?)
        let id = ''
        if ( key ) {
            id = u_data[key]
        } else {
            id = u_data._id
            if ( id === undefined ) {
                let user_txt
                if ( (typeof data) !== 'string' ) {
                    user_txt = JSON.stringify(u_data)
                } else {
                    user_txt = data
                }
                id = await this.id_hashing(user_txt)  // or this.oracular_storage()
            }
        }
        u_data._id = id
        u_data._tx_directory_ensurance = true        // for the endpoint  -- might not need it    // m_path is user
        let dont_remote = false
        let result = await this.pdb.update(u_data,dont_remote,'create')   // the end point will write information into files and create directories...
                                // a response service will react sending new information to subscribers...
        if ( cb !== undefined ) cb(result)
        return(id)
    }

    //
    /**
     * 
     * @param {string} id 
     * @param {Function} cb 
     * @returns {object} - the user object stored in the DB
     */
    async fetch_user(id,cb) { // up to the application...(?) // just work with the presistent DB
        return(await this.pdb.findOne(id,cb))
    }

    // 
    /**
     * 
     * @param {object} u_data 
     * @param {string} id_key 
     * @param {Function} cb 
     */
    async update_user(u_data,id_key,cb) {     // just work with the presistent DB
        let id = ''
        if ( key ) {
            id = u_data[id_key]
        } else {
            id = u_data._id
        }
        if ( u_data._id == undefined ) {
            u_data._id = id
        }
        u_data._tx_directory_ensurance = true   // m_path is user
        let dont_remote = false
        let result = await this.pdb.update(u_data,dont_remote,'update')   // the end point will write information into files and create directories...
        if ( cb !== undefined ) cb(result)
    }

}


module.exports = GeneralUserDBWrapperImpl
