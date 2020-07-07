const TaggedTransition = require.main.require("./lib/tagged_transitions")

// Captcha Users
class CaptchaUsers extends TaggedTransition {
    constructor() {
        super("user")
    }

    existence_query(udata) {
        return { "email" : udata.email }
    }

    from_cache() {
        return(true)
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

    match_key() {
        return("session_token")
    }

    action_selector(action) {
        let idx = ['login','register'].indexOf(action)
        return(idx >= 0)
    }

    sess_data_accessor() {
        return('tandems')
    }

    update(data) {
        data.name = data.email
        data.pass = generate_password()
        return(data)
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
class ContactPaths extends TaggedTransition {
    constructor() {
        super("contact")
    }
    //
    update(data) {
        data.comment = ('' + data.token) + '\n' + data.comment.trim()
        return(data)
    }
}

// Password Reset
class PasswordReset extends TaggedTransition {
    constructor() {
        super("password-reset")
    }
    //

}


class CaptchaCustomTransitions {
    constructor() {
        this.captcha_keyed = new CaptchaPaths()
        this.contact_keyed = new ContactPaths()
        this.users_keyed = new CaptchaUsers()
        this.password_keyed = new PasswordReset()
    }

    initialize() {
        global.G_captcha_trns = this.captcha_keyed
        global.G_contact_trns = this.contact_keyed
        global.G_users_trns = this.users_keyed
        global.G_password_reset_trns = this.password_keyed
    }
}

module.exports = new CaptchaCustomTransitions()
