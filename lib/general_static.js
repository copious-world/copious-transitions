const fs = require('fs')
const AppLifeCycle = require("lib/general_lifecyle")
const { promisify } = require("util")


function itemize_dir(dir_name) {
    //
    return({}) // if all else fails
}


var g_string_types = ['ascii','utf8','json','text',"html"]

function load_file(fname,ftype) {   // could do Promise.all to speed up startup...
    let data = fs.readFileSync(fname)
    if ( g_string_types.indexOf(ftype) >= 0 ) {
        data = data.toString()
    }
    if ( ftype === 'json' ) {
        data = JSON.parse(data)
    }
    return data
}

var async_file_loader = promisify(fs.readFile)
async function async_load_file(fname,ftype)  {
    try {
        let data = await async_file_loader(fname)
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



class GeneralStatic extends AppLifeCycle {
    //
    constructor(AppStaticStorageClass) {
        this.db = null
        this.preloaded = {} // nothing preloaded
        this.custom_static_store = null
        if ( AppStorageClass ) {
            this.custom_static_store = new AppStaticStorageClass()
        }
        this.intervalRefs = []
    }
    //
    fetch(asset_key) {
        if ( asset_key ) {
            let asset = this.preloaded[asset_key]
            if ( asset ) return(asset)
            else {
                asset = this.static_store(asset_key)
                if ( asset ) return(asset)
                else if ( this.db ) {
                    return(this.db.static_store(asset))
                }        
            }
        }
        return("")
    }
    //
    initialize(db_obj,conf) {
        this.db = db_obj
        if ( conf ) {
            this.claim_asset_directory(conf.static_files.directory)
            this.claim_assets(conf.static_files.files)  // can override directory entries
            this.preload_all(conf)
        }
    }
    //
    static_store(asset_key) {  // the app might not want to call out a DB implementation... so this is a little extra
        if ( this.custom_static_store ) {
            return(this.custom_static_store.fetch(asset_key))
        }
        return(false)
    }
    //
    claim_assets(file_map) {
        for ( var entry in file_map ) {
            this.preloaded[entry]  = file_map[entry]
        }
    }

    claim_asset_directory(dir_name) {
        let preload_dir = itemize_dir(dir_name)
        for ( var entry in preload_dir ) {
            this.preloaded[entry]  = preload_dir[entry]
        }
    }

    preload_all(conf) {
        if ( this.custom_static_store ) {
            this.custom_static_store.load(this.preloaded)
        } else {
            for ( let fileKey in this.preloaded ) {
                this.preloaded[fileKey].data = load_file(this.preloaded[fileKey].fname,this.preloaded[fileKey].ftype)
            }
        }
    }

    async reload(fileKey) {
        let loadable_asset = this.preloaded[fileKey]
        let data = await async_load_file(loadable_asset.fname,loadable_asset.ftype)
        return(data)
    }


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


}


module.exports = GeneralStatic
