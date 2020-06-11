//const GeneralStatic = require('lib/general_dynamic')

const svgCaptcha = require('svg-captcha');

const myStorageClass = null

class CaptchaDynamic {
    //
    constructor() {
        //super(myStorageClass)
        this.db = null
    }

    fetch_elements(transition,transtionObj) {
        if ( transition === "captcha" ) {
            let captcha = svgCaptcha.create();
            let elements = { 'text' : encodeURIComponent(captcha.data), 'match' : captcha.text }
            return elements
        }
        return({}) // empty object, no case matched
    }
    
    initialize(db) {
        this.db = db
    }
}

    

module.exports = new CaptchaDynamic()
