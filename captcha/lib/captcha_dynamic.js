const { GeneralDynamic } = require('../../index')

const svgCaptcha = require('svg-captcha');

const myStorageClass = null

class CaptchaDynamic extends GeneralDynamic {
    //
    constructor() {
        super(myStorageClass)
        this.db = null
    }

    fetch(asset,transitionObj) {

        if ( asset === 'tell-time' ) {
            let date = new Date()
            let datestr = date.toLocaleString()
            let reporter = {
                "mime_type" : "text/plain",
                "string" : datestr
            }
            return reporter
        } else if ( asset === 'chocolate' ) {
            transitionObj.matcher = "random-guess"
            let asset_object = {
                "mime_type" : "text/plain",
                "string" : "Check if checked:: " + Math.trunc(Math.random()*10000)
            }
            return asset_object
        }
        //
        return false
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
