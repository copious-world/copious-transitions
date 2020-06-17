
const TaggedTransition = require("lib/tagged_transitions")
const uuid = require('uuid/v4')

// Captcha Paths
class CaptchaPaths extends TaggedTransition {
    constructor() {
        super("captcha")
        this.addModule('dynamic')
    }

    match_key() {
        return('captcha_val')
    }

    uuid_prefix() {
        return('svg+')
    }

}

// Contact Paths
class UploaderPaths extends TaggedTransition {
    constructor() {
        super("upload")
    }
    //
    update(data,token) {
        data.password = uuid()
    }

    transform_file_name(file_name) {
        return(file_name.replace('.','_'))
    }

    file_entry_id(file_key) {
        return("")
    }
}

class CaptchaCustomTransitions {
    constructor() {
        this.captcha_keyed = new CaptchaPaths()
        this.uploader_keyed = new UploaderPaths()
    }

    initialize() {
        global.G_captcha_trns = this.captcha_keyed
        global.G_uploader_trns = this.uploader_keyed
    }
    
}

module.exports = new CaptchaCustomTransitions()