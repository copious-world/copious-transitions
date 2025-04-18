const fs = require('fs')
const fsPromises = require('fs/promises')
const AppLifeCycle = require("./general_lifecyle")
const path = require('path')


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

function no_trailing(char,str) {
    while ( str.lastIndexOf(char) === (str.length - 1) ) {
        str = str.slice(0,-1)
    }
    return(str)
}

/*
function require_trailing(char,str) {
    if ( str.lastIndexOf(char) !== (str.length - 1) ) {
        str = str + char
    }
    return(str)
}

function no_leading(char,str) {
    while ( str.length && ( str[0] != char ) ) {
        str = str.substr(1)
    }
    return(str)
}
*/

function require_leading(char,str) {
    if ( str[0] !== char ) {
        str = char + str
    }
    return(str)
}

function itemize_dir(dir_name) {
    let item_map = {}
    try {
        let dirList = fs.readdirSync(dir_name)
        dirList.forEach(file => {
            let bname = path.basename(file)
            let type = path.extname(file)
            let key = bname.replace(type,'')
            item_map[key] = { 'fname' : file, 'ftype'  : type }
        })
    } catch (e) {
    }
    return(item_map) // if all else fails
}

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


let g_string_types = ['ascii','utf8','json','text',"html"]

function load_file(fname,ftype) {   // could do Promise.all to speed up startup...
    if ( g_debug ) console.log(fname)
    let data = ""
    try {
        console.log(`reading file ${fname}`)
        data = fs.readFileSync(fname)
        if ( g_string_types.indexOf(ftype) >= 0 ) {
            data = data.toString()
        }
        if ( ftype === 'json' ) {
            data = JSON.parse(data)
        }    
    } catch (e) {}
    return data
}


async function async_load_file(fname,ftype)  {
    try {
        let data = await fsPromises.readFile(fname)
        if ( g_string_types.indexOf(ftype) >= 0 ) {
            data = data.toString()
        }
        if ( ftype === 'json' ) {
            data = JSON.parse(data)
        }
        return data
    } catch (e) {
        if ( ftype === 'json' ) return {}
        else return("")
    }
}

/** 
 * 
 * This class provide a basic interface for carrying out actions required for providing static content.
 * Here **Static Content** is taken to mean content that is created previous to the launch of the application.
 * 
 * The application sets a static store by passing a class (constructor) to the GeneralStatic constructor
 * as in new GeneralStatic(MyStaticStoreClass)  v.s. new GeneralStatic(), which uses the general database static storage class.
 * 
 * This static storage is not a replacement for all ways of serving static files. The primary web server of an website might
 * be the best place for setting up static file service. 
 * 
 * The presence of this class in the library can be used in conjunction with the contractual access clases. And, there may be some 
 * files best stored with the application code - and that might have more to do with installation of an application than configuring 
 * the static load.
 * 
 * Also, this module has methods for preparing JSON descriptors of HTML and JavaScript that goes with it. This allows for 
 * parts of pages to be delivered as lazy loaded components.
 * 
 * Finally, some processes may request files from the local process.
 * 
 * @memberof base
 */

class GeneralStatic extends AppLifeCycle {
    //
    constructor(AppStaticStorageClass) {
        super()
        //
        this.db = null
        this.trans_engine = null
        //
        this._preloaded = {} // nothing preloaded
        this._preloaded_guarded = {} // nothing preloaded
        this.custom_static_store = null
        if ( AppStaticStorageClass ) {
            this.custom_static_store = new AppStaticStorageClass()
        }
    }
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    /**
     * Loads files from locations that are identified in the `static_files` field of the configuration.
     * The `static_files` object may have a directory field, in which case all the files in the directory will be loaded.
     * Otherwise, it will have a map of files, *files*, which will be transfered into the `_preloaded` map.
     * 
     * Once all the entries are established in the map `_preloaded`, they data is loaded into the map for later access. 
     * 
     * @param {object} db_obj 
     * @param {object} conf 
     */
    initialize(db_obj,conf) {
        this.db = db_obj
        this.class_conf = conf.static_assets
        if ( this.class_conf ) {
            this.claim_asset_directory(this.class_conf.static_files.directory)
            this.claim_assets(this.class_conf.static_files.files)  // can override directory entries
            this.preload_all(this.class_conf)
        }
        if ( typeof this.custom_static_store === 'function' ) {
            try {
                this.custom_static_store.initialize(db_obj,this.class_conf)
            } catch (e) {
            }
        }
    }
    //
    /**
     * Set the transion engine reference.
     * @param {object} transition_engine - a reference to the application transition engine
     */
    set_transition_engine(transition_engine) {
        this.trans_engine = transition_engine
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



    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    //
    //          FETCH
    /**
     * 
     * fetch
     * 
     * 
     * This method may be the point of this module. It attempts to find a static asset and return an object 
     * describing it if it does find it.
     * 
     * The contractual methods that use this method
     * prefer to have an object delivered wiht two fields `mime_type` and `string`. The first field 
     * identifies the type of object that it is, the second is the string representation of the object.
     * 
     * In most cases, this returns an object from the `_preloaded` table. But, if the object is not there, 
     * this method will return a dissapointing message. The DB is only available to a guarded path.
     * 
     * @param {string} asset_key 
     * @param {object} etc - and object to pass to `static_store` if used.
     * @returns {object}
     */
    async fetch(asset_key,etc) {
        if ( asset_key ) {
            // first try to get a preloaded asset.... (the idea is that there should not be too many, so this search will be fast)
            let asset = this._preloaded[asset_key]
            if ( asset ) { return(asset) }
        }
        return("not found -- no direct file reads")
    }

    /**
     * 
     * guarded_fetch
     * 
     * This method may be the second point of this module. It attempts to find a static asset and return an object 
     * describing it if it does find it.  Unlike its sibling, `fetch`, it must be called in a guarded path.
     * 
     * The contractual methods that use this method
     * prefer to have an object delivered wiht two fields `mime_type` and `string`. The first field 
     * identifies the type of object that it is, the second is the string representation of the object.
     * 
     * In most cases, this returns an object from the `_preloaded_guarded` table. But, if the object is not there, 
     * this method will try to find it in the DB or in the custom static store.
     * 
     * @param {string} asset_key 
     * @param {object} etc - and object to pass to `static_store` if used.
     * @returns {object}
     */
    async guarded_fetch(asset_key,etc) {
        if ( asset_key ) {
            // first try to get a preloaded asset.... (the idea is that there should not be too many, so this search will be fast)
            let asset = this._preloaded_guarded[asset_key]
            if ( asset ) { return(asset) }
            else {
                // since the asset is not "PRELOADED", but it is calld from a `guarded` path.
                asset = this.static_store(asset_key,etc)   // look into the a custom static store if there is one.
                if ( asset ) { return(asset) }
                else if ( this.db ) {       // the most likely fallback given the application has not provided a custom static store
                    let result = await this.db.static_store(asset_key)
                    return(result)  // defer to the static store managed by general db 
                }        
            }
        }
        return("not found -- no direct file reads")
    }

        
    /**
     * static_store -- a custom store supplied by the application in lieu of other other stores the application may supply to the db
     * the app might not want to call out a DB implementation... so this is a little extra
     * This makes the supplied static store custom for just the static pathways and falls out of scope of other assets 
     * managed through the DB. (Use this option carefully)
     * 
     * @param {string} asset_key 
     * @param {object} etc -- information sent by the application of unknown structure but surely an object
     * @returns {object|boolean} returns false if no `custom_static_store` has been set up. Returns the result of `custom_static_store.fetch` othewise.
     */
    static_store(asset_key,etc) {
        if ( this.custom_static_store ) {
            return(this.custom_static_store.fetch(asset_key,etc))
        }
        return(false)
    }

    
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    //  claim_assets   -- copies the file map into the _preloaded map (keys to asset data...)
    //
    claim_assets(file_map) {
        if ( file_map ) {
            for ( let entry in file_map ) {
                this._preloaded[entry]  = file_map[entry]
            }
        }
    }

    //
    //  claim_asset_directory  --- reads in an entire directory of assets and places them into the _preloaded map
    //
    claim_asset_directory(dir_name) {
        if ( dir_name ) {
            let preload_dir = itemize_dir(dir_name)
            this.claim_assets(preload_dir)
        }
    }

    //
    /**
     * 
     * The configuration object is available for those applications that use it to identify files 
     * to be loaded. 
     * 
     * The result of calling this method should be that the table `_preloaded[fileKey]` should have a number 
     * of assests stored in memory for later retrieval.
     * 
     * If the `custom_static_store` has been set up using a parameter to the constructor (AppStaticStorageClass),
     * the custom store will be used to load the `_preloaded` map. Otherwise, files will be loaded from the paths
     * found in thie objects stored in the the `_preloaded` map.
     * 
     * @param {object} conf 
     */
    preload_all(conf) {  // a descendant might use conf
        if ( this.custom_static_store ) {
            this.custom_static_store.load(this._preloaded)
        } else {
            for ( let fileKey in this._preloaded ) {
                this._preloaded[fileKey].data = load_file(this._preloaded[fileKey].fname,this._preloaded[fileKey].ftype)
            }
        }
    }

    //
    /**
     * 
     * @param {string} fileKey 
     * @returns {string}
     */
    async reload(fileKey) {
        let loadable_asset = this._preloaded[fileKey]
        if ( loadable_asset ) {
            let data = await async_load_file(loadable_asset.fname,loadable_asset.ftype)
            return(data)    
        }
    }

    /**
     * Some assets are delivered to the web app as an object with two parts, script and html...
     * This takes an html page (maybe just some part of one) with script and html. It splits the page into the two parts
     * and then it stores the pair for delivery.
     * 
     * @param {Buffer} data 
     * @returns {object} - this is an object with two fields, `html` and `script`.
     */

    prepare_asset(data) {
        if ( !(data) ) {
            console.error("Static asset prepare, file not fount")
            return ""  // empty string
        }
        let htmlpage = data.toString()
        //
        let html_parts = htmlpage.split("<script>")
        let html = html_parts[0]
        //
        let script = html_parts[1]
        script = script.replace('</script>','').trim()
        //console.log(script)
        let json = {
          "html" : encodeURIComponent(html),
          "script" : encodeURIComponent(script)
        }
        return(json)
    }

    //
    // generic_prep_cwd_offset
    //
    /**
     * Some applications call this method during preloading.
     * This method looks for the field `app_spec` on the `static_files` field of the configuration object.
     * 
     * After making an attemp to clean up the string, which is a relative directory to the root directory, 
     * this method update all the `fname` fields of the descriptors stored in the `_preloaded` map.
     * 
     * @param {object} conf 
     */
    generic_prep_cwd_offset(conf) {
        //
        if ( conf && conf.static_files && conf.static_files.app_spec ) {
            //
            let application_specific_loc = conf.static_files.app_spec.trim()
            application_specific_loc = no_trailing('/',application_specific_loc)
            application_specific_loc = require_leading('/',application_specific_loc)
            //
            if ( application_specific_loc ) {
                //
                let root_dir = process.cwd()
                for ( let asset in this._preloaded ) {
                    //
                    let assetDescr = this._preloaded[asset]
                    let fname = assetDescr.fname
                    fname = require_leading('/',fname)
                    assetDescr.fname = root_dir + application_specific_loc + fname
                }
                //
            }
        }    
    }
}


module.exports = GeneralStatic
