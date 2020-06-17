const TaggedTransition = require("lib/tagged_transitions")

// Captcha Users
class CaptchaUsers extends TaggedTransition {
    constructor() {
        super("user")
    }

    existence_query(udata) {
        return { "email" : udata.email }
    }

    back_ref() {
        return("user_id")
    }

    kv_store_key() {
        return("user_id")
    }

    primary_key() {
        return("email")
    }

    session_key() {
        return("email")
    }

    action_selector(action) {
        let idx = ['login','register'].indexOf(action)
        return(idx >= 0)
    }
}

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
class ConntactPaths extends TaggedTransition {
    constructor() {
        super("contact")
    }
    //
    update(data) {
        data.comment = ('' + data.token) + '\n' + data.comment.trim()
        return(data)
    }
}



class CaptchaCustomTransitions {
    constructor() {
        this.captcha_keyed = new CaptchaPaths()
        this.contact_keyed = new ConntactPaths()
        this.users_keyed = new CaptchaUsers()
    }

    initialize() {
        global.G_captcha_trns = this.captcha_keyed
        global.G_contact_trns = this.contact_keyed
        global.G_users_trns = this.users_keyed
    }
}

module.exports = new CaptchaCustomTransitions()
