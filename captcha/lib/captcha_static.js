const GeneralStatic = require.main.require('./lib/general_static')

const myStorageClass = null

class CaptchaStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
        //
        this.preloaded = {
            "login" : { "fname" : '/login.html', "ftype" : "html" },
            "register" : { "fname" : '/register.html', "ftype" : "html" },
            "forgetful" : { "fname" : '/forgot.html', "ftype" : "html" }
        }
        //
        this.login_asset_media_object = null
        this.register_asset_media_object = null
        this.forgetful_asset_media_object = null
    }

    preload_all(conf) {
        if ( conf.static_files ) {
            this.generic_prep_cwd_offset(conf)
        }
        //
        super.preload_all()
        //       
    }

    fetch(asset) {
        return(super.fetch(asset))
    }
    
}


module.exports = new CaptchaStatic()
