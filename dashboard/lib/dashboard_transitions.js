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


class DashboardCustomTransitions {
    constructor() {
        this.dashboard_keyed = new Dashboards()
    }

    initialize() {
        global.G_dashboard_trns = this.dashboard_keyed
    }
}

module.exports = new DashboardCustomTransitions()
