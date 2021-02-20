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


var g_string_types = ['ascii','utf8','json','text',"html"]

function load_file(fname,ftype) {   // could do Promise.all to speed up startup...
    if ( g_debug ) console.log(fname)
    let data = fs.readFileSync(fname)
    if ( g_string_types.indexOf(ftype) >= 0 ) {
        data = data.toString()
    }
    if ( ftype === 'json' ) {
        data = JSON.parse(data)
    }
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


// The application sets a static store by passing a class (constructor) to the GeneralStatic constructor
// as in new GeneralStatic(MyStaticStoreClass)  v.s. new GeneralStatic(), which uses the general database static storage class


class GeneralStatic extends AppLifeCycle {
    //
    constructor(AppStaticStorageClass) {
        super()
        //
        this.db = null
        this.trans_engine = null
        //
        this._preloaded = {} // nothing preloaded
        this.custom_static_store = null
        if ( AppStaticStorageClass ) {
            this.custom_static_store = new AppStaticStorageClass()
        }
    }
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    initialize(db_obj,conf) {
        this.db = db_obj
        if ( conf ) {
            this.claim_asset_directory(conf.static_files.directory)
            this.claim_assets(conf.static_files.files)  // can override directory entries
            this.preload_all(conf)
        }
    }
    //
    set_transition_engine(transition_engine) {
        this.trans_engine = transition_engine
    }
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    //
    //          FETCH
    fetch(asset_key) {
        if ( asset_key ) {
            // first try to get a preloaded asset.... (the idea is that there should not be too many, so this search will be fast)
            let asset = this._preloaded[asset_key]
            if ( asset ) { return(asset) }
            else {
                // since the asset is not "PRELOADED"
                asset = this.static_store(asset_key)   // look into the a custom static store if there is one.
                if ( asset ) { return(asset) }
                else if ( this.db ) {
                    return(this.db.static_store(asset_key))  // defer to the static store managed by general db 
                }        
            }
        }
        return("not found -- no direct file reads")
    }

    /*
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    // static_store -- a custom store supplied by the application in lieu of other other stores the application may supply to the db
    //      -- the app might not want to call out a DB implementation... so this is a little extra
    //      -- This makes the supplied static store custom for just the static pathways and falls out of scope of other assets 
    //      -- managed through the DB. (Use this option carefully)
    static_store(asset_key) {
        if ( this.custom_static_store ) {
            return(this.custom_static_store.fetch(asset_key))
        }
        return(false)
    }
    */

    
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    //  claim_assets   -- copies the file map into the _preloaded map (keys to asset data...)
    //
    claim_assets(file_map) {
        if ( file_map ) {
            for ( var entry in file_map ) {
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
    async reload(fileKey) {
        let loadable_asset = this._preloaded[fileKey]
        if ( loadable_asset ) {
            let data = await async_load_file(loadable_asset.fname,loadable_asset.ftype)
            return(data)    
        }
    }

    //
    //  prepare_asset --- 
    //      -- some assets are delivered to the web app as an object with two parts, script and html...
    //      -- this takes and html page (maybe just some part of one) with script and html. It splits the page into the two parts
    //      -- and then it stores it for delivery.
    // 
    prepare_asset(data) {
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
