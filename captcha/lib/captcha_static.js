const GeneralStatic = require.main.require('./lib/general_static')

const myStorageClass = null

class CaptchaStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
        //
        this.preloaded = {
            "login" : { "fname" :__dirname + '/user/login.html', "ftype" : "html" },
            "register" : { "fname" :__dirname + '/user/register.html', "ftype" : "html" },
            "forgetful" : { "fname" :__dirname + '/user/forgot.html', "ftype" : "html" }
        }
        //
        this.login_asset_media_object = null
        this.register_asset_media_object = null
        this.forgetful_asset_media_object = null
    }

    preloaded_all(conf) {
        //
        super.preloaded_all()
        //
        // A) LOGIN FORM
        let data = this.preloaded.uploader.data
        let json = this.prepare_asset(data)
        //
        this.login_asset_media_object = {
            "mime_type" : "appliation/json",
            "string" : JSON.stringify(json)
        }
        //
        // B) REGISTER FORM
        data = this.preloaded.song_submit.data
        json = this.prepare_asset(data)
        //
        this.register_asset_media_object = {
            "mime_type" : "application/json",
            "string" : JSON.stringify(json)
        }
        //
        // C) FORGETFUL FORM
        data = this.preloaded.song_submit.data
        json = this.preloaded.song_of_day_info.data
        //
        this.forgetful_asset_media_object = {
            "mime_type" : "application/json",
            "string" : JSON.stringify(json)
        }
        
    }

    fetch(asset) {
        if ( asset == "login" ) {
            if ( !(this.login_asset_media_object) ) {
                return("empty")
            } else {
                return(this.login_asset_media_object)
            }
        } else if ( asset == "register" ) {
            if ( !(this.register_asset_media_object) ) {
                return("empty")
            } else {
                return(this.register_asset_media_object)
            }
        } else if ( asset == "forgetful" ) {
            if ( !(this.forgetful_asset_media_object) ) {
                return("empty")
            } else {
                return(this.forgetful_asset_media_object)
            }
        } else {
            return(super.fetch())
        }
    }
    
}


module.exports = new CaptchaStatic()
