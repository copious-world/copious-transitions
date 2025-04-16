const AppLifeCycle = require("./general_lifecyle")
const fs = require('fs')


/** 
 * This class provide a basic interface for carrying out actions required for providing dynamic content.
 * Here **Dynamic Content** is taken to mean content that is created by the application in repsonse to a query.
 * 
 * NOTE: all the base classes in /lib return the class and do not return an instance. Explore the applications and 
 * the reader will find that the descendant modules export instances. The classes provided by copious-transitions must
 * be extended by an application.
 * 
 * @memberof base
 */
class GeneralDynamic extends AppLifeCycle {
    constructor(conf) {
        super()
        //
        this.trans_engine = null
        this.db = null
        this.imported_key_setters = []
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
     * This initializer does no more than set the connection to the database.
     * @param {object} db 
     */
    initialize(db,conf) {
        this.class_conf = conf && conf.dynamic_assets  ?  conf.dynamic_assets : false// might usually be ignored... (or not... depending on the application)
        this.db = db
    }

    /**
     * 
     * @param {object} transition_engine - a connect to the transition engine
     */
    set_transition_engine(transition_engine) {
        this.trans_engine = transition_engine
    }

    /**
     * This method looks for the dynamic asset and may request that some view of it be constructed
     * in response to the request that results in a call to this method.
     * 
     * This is called by mime processing.
     * 
     * @param {string} asset 
     * @param {object} trans_object 
     * @returns {object}
     */
    fetch(asset,trans_object) {
        // proecess this asset and return it.
        let assetObj = {
            'string' : 'not yet implemented',
            'mime_type' : 'text/plain'
        }
        return(assetObj)
    }

    /**
     * This method looks for the dynamic asset and may request that some view of it be constructed
     * in response to the request that results in a call to this method.
     * 
     * This is called by transition processing.
     * 
     * Transition processing may require some data to be stored between the primary and secondary action (request).
     * This method will produce *stored elements* and *sent elements*. 
     * 
     * @param {string} asset 
     * @param {object} trans_object 
     * @returns {Array} This array has two elements. The first elements is the data to be sent to the client, the second are elements that are to be cached for a secondary action.
     */
    fetch_elements(asset,trans_object) {
        return [{},{}]
    }

    /**
     * 
     * @param {string} key_location 
     * @param {Function} cb 
     * @returns {string}
     */
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


    /**
     * May be called to set up a list of functions that may be used in an importer function.
     * 
     * @param {string} key 
     * @param {Array} uses 
     * @param {Function} setter_fn 
     */
    add_import(key,uses,setter_fn) {
        this.imported_key_setters.push({ "key" : key, "setter_fn" : setter_fn, "uses" : uses })
    }

    /**
     * Called by the general transition engine.
     * The general transition engine supplies a function to `import_keys` that uses 
     * a key and `uses` (an array or map) from each key setter, a descriptor to create a key to use
     * in the *setter* function.
     * 
     * The keys and uses are related to cryptographic applications
     * 
     * Each key setter descriptor will have three fields:
     * * `key` - some type of crypto key (each an elliptic key for derivation)
     * * `setter_fn` - a function that takes the key created by the imported function
     * * `uses` - an array of string or descriptors (objects) indicating the function of the key, e.g. signage or verification
     * 
     * The key and the uses are passed to the importer function which produce a key, (a descriptive string)
     * The setter, from the `imported_key_setters` element, is then called. 
     * 
     * @param {Function} importer_fn 
     */
    import_keys(importer_fn) {
        if ( importer_fn ) {
            this.imported_key_setters.forEach(async (keysetter) => {
                let key = keysetter.key
                let setter = keysetter.setter_fn
                let uses = keysetter.uses
                let imp_key = await importer_fn(key,uses)
                setter(imp_key,this)
            })
        }
    }
}


module.exports = GeneralDynamic

