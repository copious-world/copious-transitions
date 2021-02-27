const TaggedTransition = require.main.require("./lib/tagged_transitions")

// Dashboard Users
class Dashboards extends TaggedTransition {
    constructor(descendant) {
        if ( descendant ) {
            super(descendant)
        } else {
            super("dashboard")
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
        let idx = ['dashboard'].indexOf(action)
        return(idx >= 0)
    }

    secondary_action_selector(action) {
        let idx = ['dashboard-secondary'].indexOf(action)
        return(idx >= 0)
    }

    sess_data_accessor() {
        return('dashboard')
    }

    update(data) {
        return([data,{}])
    }

}

class DashboardsCommands extends Dashboards {
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

    can_publish(topic) {
        // check to see if the topic belongs to a profile operation...
        if ( (topic in this.ok_topics) || (topic in this.ok_command)) {
            return true
        }
        return false
    }

}


class DashboardCustomTransitions {
    constructor() {
        this.dashboard_keyed = new Dashboards()
        this.dash_command_keyed = new DashboardsCommands()
    }

    initialize() {
        global.G_dashboard_trns = this.dashboard_keyed
        global.G_dashboard_commands_trns = this.dash_command_keyed
    }
}

module.exports = new DashboardCustomTransitions()
