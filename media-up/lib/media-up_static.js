const GeneralStatic = require.main.require('./lib/general_static')

const myStorageClass = null

class MediaUpStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
        //
        this.preloaded = {
            "demo_uploader" : { "fname" : '/uploader.html', "ftype" : "html" },
            "pub_submit" : { "fname" : '/submitter.html', "ftype" : "html" }
        }
        //
        this.demo_asset_media_object = null
        this.publication_asset_media_object = null
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
        let data = this.preloaded.demo_uploader.data
        let json = this.prepare_asset(data)
        //
        this.demo_asset_media_object = {
            "mime_type" : "appliation/json",
            "string" : JSON.stringify(json)
        }
        //
        // B) PUBLICATION SUBMISSION FORM -- pub_submit  -- e.g. song of day submission, article, etc.
        data = this.preloaded.pub_submit.data
        json = this.prepare_asset(data)
        //
        this.publication_asset_media_object = {
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
        } else {
            return(super.fetch())
        }
    }
    
}


module.exports = new MediaUpStatic()
