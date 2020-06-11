const fs = require('fs')

function itemize_dir(dir_name) {
    //
    return({}) // if all else fails
}


var g_string_types = ['ascii','utf8','json','text']

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

class GeneralStatic {
    //
    constructor(AppStaticStorageClass) {
        this.db = null
        this.preloaded = {} // nothing preloaded
        this.custom_static_store = null
        if ( AppStorageClass ) {
            this.custom_static_store = new AppStaticStorageClass()
        }
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
            this.preloaded_all()
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

    preloaded_all() {
        if ( this.custom_static_store ) {
            this.custom_static_store.load(this.preloaded)
        } else {
            for ( let fileKey in this.preloaded ) {
                this.preloaded[fileKey].data = load_file(this.preloaded[fileKey].fname,this.preloaded[fileKey].ftype)
            }
        }
    }

}


module.exports = GeneralStatic
