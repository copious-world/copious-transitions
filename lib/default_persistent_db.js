
const fs = require('fs')
const AppLifeCycle = require("./general_lifecyle")
const uuid = require('uuid/v4')

const DB_STASH_INTERVAL = 1000

class FileMapper extends AppLifeCycle {
    constructor() {
        super()
        this.storage_map = {}
        this.dirty = false
        this.root_path = process.mainModule.path
    }

    app_shutdown() {
        fs.writeFileSync(this.db_file,JSON.stringify(this.storage_map))
    }

    initialize(conf) {
        this.db_file = this.root_path + '/' + (conf.db_file ? conf.db_file : '/userdata.db')
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

        this.add_interval(extant_interval)
    }

    create(obj,cb) {
        if ( obj._id && this.storage_map[obj._id] ) {
            if ( cb ) cb(new Error("already exists"),null)
        }
        if ( !obj._id ) {
            obj._id = uuid()
        }
        this.storage_map[obj._id] = obj
        if ( cb ) cb(null)
    }

    update(obj,cb) {
        if ( !(obj._id) || !(this.storage_map[obj._id]) ) {
            if ( cb ) cb(new Error("does not exists"),null)
        }
        this.storage_map[obj._id] = obj
        this.dirty = true
        if ( cb ) cb(null)
    }

    delete(id,cb) {
        if ( !(this.storage_map[id]) ) {
            if ( cb ) cb(new Error("does not exists"),null)
        }
        delete this.storage_map[id]
        this.dirty = true
        if ( cb ) cb(null)
    }

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

    all_keys() {
        return(Object.keys(this.storage_map))
    }
}





module.exports = new FileMapper()