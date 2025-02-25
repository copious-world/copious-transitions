const { GeneralDynamic } = require('../../index')

const svgCaptcha = require('svg-captcha');

const myStorageClass = null

class CaptchaDynamic extends GeneralDynamic {
    //
    constructor() {
        super(myStorageClass)
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

    

module.exports = new CaptchaDynamic()
