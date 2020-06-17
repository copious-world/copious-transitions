const { GeneralAuth, SessionManager } = require('lib/general_auth')
//
const expressSession = require('express-session');

class SearcherSessionManager extends SessionManager {

    constructor(exp_app,db_obj) {
        //
        super(exp_app,db_obj)
        //
        let db_store = db_obj.session_store.generateStore(expressSession)  // custom application session store for express 
        //
        this.session = expressSession({         // express session middleware
            secret: conf.sessions.secret,
            resave: true,
            saveUninitialized: true,
            proxy : true,
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: false,
            genid: (req) => {
                return uuid() // use UUIDs for session IDs
            },
            store: db_store,
            cookie: {
                secure: false,
                httpOnly: true,
                domain: conf.domain
            }
        })

        this.middle_ware.push(cookieParser())           // use a cookie parser
        this.middle_ware.push(this.session)             // this is where the session object is introduced as middleware
    }

    //process_asset(asset_id,post_body) {}
    feasible(transition,post_body,req) {                // is the transition something that can be done?
        if (  G_spotify_searcher_trns.tagged(transition) ) {
            return(true)
        }
        return(super.feasible(transition,post_body,req))
    }

    process_transition(transition,post_body,req) {
        let transObj = super.process_transition(transition,post_body,req)
        transObj.query = post_body,query
        transObj.offset = post_body.offset
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

var session_producer = new SongSearchAuth()
module.exports = session_producer;