
const fs = require('fs')

class FileMapper {
    constructor() {
        this.storage_map = {}
        this.dirty = false
    }

    initialize(conf) {
        this.db_file = conf.db_file ? conf.db_file : 'userdata.db'
        try {
            this.storage_map  = JSON.parse(fs.readFileSync(this.db_file,'ascii').toString())
        } catch(e) {
            return(false)
        }

        setInterval(() => {
            if ( this.dirty ) {
                fs.writeFile(this.db_file,JSON.stringify(this.storage_map),() => { this.dirty = false })
            }
        },30000)
    }

    create(obj,cb) {
        if ( this.storage_map[obj._id] ) {
            cb(new Error("already exists"),null)
        }
        this.storage_map[obj._id] = obj
        cb(null)
    }

    update(obj,cb) {
        if ( !(this.storage_map[obj._id]) ) {
            cb(new Error("does not exists"),null)
        }
        this.storage_map[obj._id] = obj
        this.dirty = true
        cb(null)
    }

    delete(id,cb) {
        if ( !(this.storage_map[id]) ) {
            cb(new Error("does not exists"),null)
        }
        delete this.storage_map[id]
        this.dirty = true
        cb(null)
    }

    findOne(id,cb) {
        let obj = this.storage_map[id]
        if ( !( obj ) ) {
            cb(new Error("does not exists"),null)
        }
        cb(null,obj)
    }
}





module.exports = new FileMapper()