const TaggedTransition = require.main.require("./lib/tagged_transitions")
const uuid = require('uuid/v4')

// Profile Users
class Profiles extends TaggedTransition {
    constructor(descendant) {
        if ( descendant ) {
            super(descendant)
        } else {
            super("profile")
        }
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
        data._tracking = uuid()
        data.key_field = "_transition_path"
        data._user_dir_key = "email"
        data._transition_path =`profile+${data.email}`
        return([data,{}])
    }

}

class ProfilesCommands extends Profiles {
    //
    constructor() {
        super('dash-commands')
        //
        this.ok_topics = [
            "blog-markdown",
            "demo-json",  // encryption check as well...
            "streams-link",
            "link_package-json"
        ]
        //
        this.ok_command = [
            "command-publish",
            "command-recind",
            "command-delete",
            "command-send"
        ]
        //
    }


    has_secondary_action(command_type) {
        return(false)
    }

    
    can_publish(topic) {
        // check to see if the topic belongs to a profile operation...
        if ( ( this.ok_command.indexOf(topic) >= 0 ) || ( this.ok_topics.indexOf(topic) >= 0 ) ) {
            return true
        }
        return false
    }

}


class ProfilesAssets extends Profiles {
    constructor() {
        super('dash-commands')
        //
        this.ok_assets = [
            "blog",
            "demo",  // encryption check as well...
            "streams",
            "link_package"
        ]
        //
        this.last_tagged = undefined
    }

    tagged(asset_type) {
        this.last_tagged = undefined
        if ( this.ok_assets.indexOf(asset_type) >= 0 ) {
            this.last_tagged = asset_type
            return(true)
        }
        return(false)
    }

    has_secondary_action(asset_type) {
        return(false)
    }

    update(data) {
        data.asset_type = this.last_tagged
        if ( data._id ) {
            data._tracking = data._id
            data.key_field = "_transition_path"
            data._user_dir_key = "email"
            data._transition_path =`${data._tracking}+${data.asset_type}+${data.email}`
            if ( data.data ) {
                data.txt_full = data.data
                data.data = undefined
            }
        } else {
            data._tracking = uuid()
            data.key_field = "_transition_path"
            data._user_dir_key = "email"
            data._transition_path =`${data._tracking}+${data.asset_type}+${data.email}`
            if ( data.data ) {
                data.txt_full = data.data
                data.data = undefined
            }
        }
    }

}


class ProfileCustomTransitions {
    constructor() {
        this.profile_keyed = new Profiles()
        this.dash_command_keyed = new ProfilesCommands()
        this.dash_assets_keyed = new ProfilesAssets()
    }

    initialize() {
        global.G_profile_trns = this.profile_keyed
        global.G_profile_commands_trns = this.dash_command_keyed
        global.G_profile_asset = this.dash_assets_keyed
    }
}

module.exports = new ProfileCustomTransitions()
