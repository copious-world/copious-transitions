const GeneralStatic = require.main.require('./lib/general_static')

const myStorageClass = false

class MediaUpStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
        //
        this._preloaded = {
            "demo_uploader" : { "fname" : '/uploader.html', "ftype" : "html" },
            "pub_submit" : { "fname" : '/submitter.html', "ftype" : "html" },
            "recorder" : { "fname" : '/recorder.html', "ftype" : "html" },
            "dialogs" : { "fname" : '/dialog_packaged.html', "ftype" : "html" }
        }
        //
        this.demo_asset_media_object = null
        this.publication_asset_media_object = null
        this.recorder_object = null
        this.ownership_worker = null
        this.dialogs_packaged = null
    }

    preload_all(conf) {
        //
        if ( conf.static_files ) {
            this.generic_prep_cwd_offset(conf)
        }

        //
        super.preload_all()
        //
        // A) DEMO UPLOAD FORM -- uploader  --- e.g. singer demo, program demo..
        let data = this._preloaded.demo_uploader.data
        let json = this.prepare_asset(data)
        //
        this.demo_asset_media_object = {
            "mime_type" : "appliation/json",
            "string" : JSON.stringify(json)
        }
        //
        // B) PUBLICATION SUBMISSION FORM -- pub_submit  -- e.g. song of day submission, article, etc.
        data = this._preloaded.pub_submit.data
        json = this.prepare_asset(data)
        //
        this.publication_asset_media_object = {
            "mime_type" : "application/json",
            "string" : JSON.stringify(json)
        }
        //
        // C) RECORDER APPLICATION -- recorder  -- e.g. recorder app for audio ownership, etc.
        data = this._preloaded.recorder.data
        json = this.prepare_asset(data)
        //
        this.recorder_object = {
            "mime_type" : "application/json",
            "string" : JSON.stringify(json)
        }
        //
        // D) POLYFILL FOR DIALOGS (HTML in transition)
        data = this._preloaded.dialogs.data
        json = this.prepare_asset(data)
        //
        this.dialogs_packaged = {
            "mime_type" : "application/json",
            "string" : JSON.stringify(json)
        }
        //
    }

    fetch(asset) {
        if ( asset == "demo-uploader" ) {
            if ( !(this.demo_asset_media_object) ) {
                return("empty")
            } else {
                return(this.demo_asset_media_object)
            }
        } else if ( asset == "publication-uploader" ) {
            if ( !(this.publication_asset_media_object) ) {
                return("empty")
            } else {
                return(this.publication_asset_media_object)
            }
        } else if ( asset == "recorder" ) {
            if ( !(this.recorder_object) ) {
                return("empty")
            } else {
                return(this.recorder_object)
            }
        } else if ( asset = "dialogs" ) {
            if ( !(this.dialogs_packaged) ) {
                return("empty")
            } else {
                return(this.dialogs_packaged)
            }
        } else {
            return(super.fetch())
        }
    }
    
}


module.exports = new MediaUpStatic()
