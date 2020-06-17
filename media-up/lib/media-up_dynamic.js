const GeneralDynamic = require('lib/general_dynamic')

const svgMediaUp = require('svg-captcha');

const myStorageClass = null

class MediaUpDynamic extends GeneralDynamic {
    //
    constructor(conf) {
        super(conf)
        this.db = null
    }

    fetch_elements(transition,transtionObj) {
        if ( G_captcha_trns.tagged(transition,'dynamic') ) {
            let captcha = svgCaptcha.create();
            let send_elements = { 'captcha' : encodeURIComponent(captcha.data) }       // send the picture 
            let store_elements = { 'match' : captcha.text }                          // keep the secret server side
            return [send_elements,store_elements]
        }
        return({}) // empty object, no case matched
    }
    
    initialize(db) {
        this.db = db
    }
}



module.exports = new MediaUpDynamic()
