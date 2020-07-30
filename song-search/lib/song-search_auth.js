const { GeneralAuth, SessionManager } = require('general_auth_session_lite')
//
const cookieParser = require('cookie-parser');

class SearcherSessionManager extends SessionManager {

    constructor(exp_app,db_obj) {
        //
        super(exp_app,db_obj)
        //
        this.middle_ware.push(cookieParser())           // use a cookie parser
    }

    feasible(transition,post_body,req) {                // is the transition something that can be done?
        if (  G_spotify_searcher_trns.tagged(transition) ) {
            return(true)
        }
        return(super.feasible(transition,post_body,req))
    }

    process_asset(asset_id,post_body) {
        if (  G_spotify_searcher_trns.tagged(asset_id) ) {
            let transObj = super.process_asset(asset_id,post_body)
            transObj.query = post_body.query
            transObj.offset = post_body.offset
        }
    } 

    process_transition(transition,post_body,req) {
        return super.process_transition(transition,post_body,req)
    }

    //
    match(post_body,transtion_object)  {
        return true
    }

    //
    finalize_transition(transition,post_body,elements,req) {    // like this until paging is worked out
        let finalization_state = {
            "state" : "OK",
            "OK" : "true"
        }
        return(finalization_state)
    }
    
}

class SongSearchAuth  extends GeneralAuth {
    constructor() {
        super(SearcherSessionManager)   // intializes general authorization with the customized session manager class.
    }
}

var session_checker = new SongSearchAuth()
module.exports = session_checker;