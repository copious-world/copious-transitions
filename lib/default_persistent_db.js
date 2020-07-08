
const fs = require('fs')


const DB_STASH_INTERVAL = 1000

class FileMapper {
    constructor() {
        this.storage_map = {}
        this.dirty = false
    }

    shutdown() {
        if ( this.extant_interval ) {
            clearInterval(this.extant_interval)
            fs.writeFileSync(this.db_file,JSON.stringify(this.storage_map))
        }
    }

    initialize(conf) {
        this.db_file = conf.db_file ? conf.db_file : (__dirname + '/userdata.db')
        try {
            this.storage_map  = JSON.parse(fs.readFileSync(this.db_file,'ascii').toString())
        } catch(e) {
            if ( e.code !== "ENOENT" ) {
                console.dir(e)
                process.exit(1)
            }
        }

        this.extant_interval = setInterval(() => {
            if ( this.dirty ) {
                fs.writeFile(this.db_file,JSON.stringify(this.storage_map),() => { this.dirty = false })
            }
        },DB_STASH_INTERVAL)
    }

    create(obj,cb) {
        if ( this.storage_map[obj._id] ) {
            if ( cb ) cb(new Error("already exists"),null)
        }
        this.storage_map[obj._id] = obj
        if ( cb ) cb(null)
    }

    update(obj,cb) {
        if ( !(this.storage_map[obj._id]) ) {
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
        }
        if ( cb ) cb(null,obj)
        else return(obj)
    }
}





module.exports = new FileMapper()