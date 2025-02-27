
const fs = require('fs')
const AppLifeCycle = require("../lib/general_lifecyle")

const DB_STASH_INTERVAL = 10000



/**
 * A standin class for persistence from the database point of view.
 * 
 * Useful for debugging.
 * 
 * Writes data to a file in the directory of execution by default.
 * 
 *
 * @memberof DefaultDB
 */

class FileMapper extends AppLifeCycle {

    constructor() {
        super()
        this.storage_map = {}
        this.dirty = false
        this.root_path = process.cwd()
        this.db_file = `${this.root_path}/userdata.db`
    }

    /**
     * on shutdown, this method will be called in order to flush out the local tables (in this case JS Objects) to the file system./
     */
    app_shutdown() {
        fs.writeFileSync(this.db_file,JSON.stringify(this.storage_map))
    }

    /**
     * Sets the path of the DB file, where data will be stored between runs.
     * Setsup up an interval benchmark writing of the file to the directory.
     * 
     * @param {object} conf 
     */
    initialize(conf) {
        this.id_maker = (typeof conf.id_maker === 'function') ? conf.id_maker : (() => { return this.#make_random_id() })
        this.db_file = this.root_path + '/' + (conf.db_file ? conf.db_file : 'userdata.db')
        try {
            this.storage_map  = JSON.parse(fs.readFileSync(this.db_file,'ascii').toString())
        } catch(e) {
            if ( e.code !== "ENOENT" ) {
                console.dir(e)
                process.exit(1)
            }
        }

        let extant_interval = setInterval(() => {
            if ( this.dirty ) {
                fs.writeFile(this.db_file,JSON.stringify(this.storage_map),() => { this.dirty = false })
            }
        },DB_STASH_INTERVAL)

        this.add_interval(extant_interval)   // app lifecycle
    }

    /**
     * The object data is passed for inclusion into the DB.
     * If the object does not have an `_id` field, the method attempts to create one.
     * A call to create will not overwrite an existing object (user update).
     * 
     * @param {object} obj 
     * @param {Function} cb - the callback will receive null if there is no error, otherwise, it will be passed an Error object.
     */
    create(obj,cb) {
        if ( obj._id && this.storage_map[obj._id] ) {
            if ( cb ) cb(new Error("already exists"),null)
        }
        if ( !obj._id ) {
            obj._id = this.id_maker()
        }
        this.storage_map[obj._id] = obj
        if ( cb ) cb(null)
    }

    /**
     * Overwrites the data of the object in the DB.
     * The object must be in the DB, or this call will provide an error to the callback (if the callback is used)
     * 
     * @param {object} obj 
     * @param {Function} cb 
     */
    update(obj,cb) {
        if ( !(obj._id) || !(this.storage_map[obj._id]) ) {
            if ( cb ) cb(new Error("does not exists"),null)
        }
        this.storage_map[obj._id] = obj
        this.dirty = true
        if ( cb ) cb(null)
    }

    /**
     * Given the object is in the map, deletes it.
     * 
     * If the callback is provided, it will call it with an error if it is not found.
     * The callback will be called with null if the object can be deleted.
     * 
     * @param {string} id 
     * @param {Function} cb 
     */
    delete(id,cb) {
        if ( !(this.storage_map[id]) ) {
            if ( cb ) cb(new Error("does not exists"),null)
        }
        delete this.storage_map[id]
        this.dirty = true
        if ( cb ) cb(null)
    }

    /**
     * Returns an object stored in the local application storage map.
     * 
     * @param {string} id 
     * @param {Function} cb 
     * @returns {boolean|object} if ther eis no callback, returns the object found otherwise true and the object is passed to the callback
     */
    findOne(id,cb) {
        let obj = this.storage_map[id]
        if ( !( obj ) ) {
            if ( cb ) cb(new Error("does not exists"),null)
            return(false)
        }
        if ( cb ) cb(null,obj)
        else return(obj)
        return(true)
    }

    /**
     * 
     * @returns {Array} - a list of all the `_id`s in the database and loaded into memory.
     */
    all_keys() {
        return(Object.keys(this.storage_map))
    }


    /**
     * Returns either a number that is defined by a global generator for an ID
     * or it will return a quasi random token that can be good for testing.
     * It is best for an application to provide a method for generating IDs via the configuration.
     * 
     * @returns {Number} a number to use as an id
     */
    #make_random_id() {
        if ( global_appwide_token === undefined ) {
            return (Date.now() ^ (Math.random()*19777))
        } else {
            return global_appwide_token()
        }
    }
}





module.exports = FileMapper