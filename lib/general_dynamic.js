const AppLifeCycle = require("./general_lifecyle")
const fs = require('fs')

class GeneralDynamic extends AppLifeCycle {
    constructor(conf) {
        super()
        //
        this.trans_engine = null
        this.db = null
        this.imported_key_setters = []
    }

    initialize(db) {
        this.db = db
    }

    set_transition_engine(transition_engine) {
        this.trans_engine = transition_engine
    }

    fetch(asset,trans_object) {
        // proecess this asset and return it.
        let assetObj = {
            'string' : 'not yet implemented',
            'mime_type' : 'text/plain'
        }
        return(assetObj)
    }

    fetch_elements(asset,trans_object) {
        return [{},{}]
    }

    async load_key(key_location,cb) {
        if ( !(key_location) || key_location.length === 0 ) {
            console.log("Application error: no key loaded for dynamic content: no path in configuration")
            process.exit(0)
        }
        return new Promise((resolve,reject) => {
            fs.readFile(key_location,(error,data) => {
                if ( error ) {
                    console.log(error)
                    throw new Error("Application error: no key loaded for dynamic content")
                }
                try {
                    let key = JSON.parse(data.toString())
                    resolve(key)    
                } catch (e) {
                    console.log("ERROR: the application cannot continue when failing to load public key")
                    process.exit(0)
                }
            })
        })
    }

    add_import(key,uses,setter_fn) {
        this.imported_key_setters.push({ "key" : key, "setter_fn" : setter_fn, "uses" : uses })
    }

    import_keys(importer_fn) {
        if ( importer_fn ) {
            this.imported_key_setters.forEach(async (keysetter) => {
                let key = keysetter.key
                let setter = keysetter.setter_fn
                let uses = keysetter.uses
                let imp_key = await importer_fn(key,uses)
                setter(imp_key)
            })
        }
    }
}


module.exports = GeneralDynamic

