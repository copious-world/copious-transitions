const TaggedTransition = require.main.require("./lib/tagged_transitions")

// Profile Users
class Profiles extends TaggedTransition {
    //
    constructor(descendant) {
        //
        if ( descendant ) {
            super(descendant)
        } else {
            super("profile")
        }
        //
        this.ok_topics = [
            "avatar-visible",
            "change-password",  // encryption check as well...
            "account-settings",
            "hash-storage"
        ]
        //
    }

    can_publish(topic) {
        // check to see if the topic belongs to a profile operation...
        if ( topic in this.ok_topics ) {
            if ( this.encryption_check(topic) ) {
                return("aes")       // return a type indicator
            }
            return true
        }
        return false
    }

    encryption_check(topic) {
        if ( topic === "change-password" ) return(true)
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
        return("email")
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

    secondary_match_key() {
        return("token")
    }

    action_selector(action) {
        let idx = ['profile'].indexOf(action)
        return(idx >= 0)
    }

    secondary_action_selector(action) {
        let idx = ['profile-secondary'].indexOf(action)
        return(idx >= 0)
    }

    sess_data_accessor() {
        return('profile')
    }

    update(data) {
        return([data,{}])
    }

}


class ProfileCustomTransitions {
    constructor() {
        this.profile_keyed = new Profiles()
    }

    initialize() {
        global.G_profile_trns = this.profile_keyed
    }
}

module.exports = new ProfileCustomTransitions()
