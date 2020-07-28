const { GeneralAuth, SessionManager } = require('general_auth_session_lite')
//
const expressSession = require('express-session');

class UploaderSessionManager extends SessionManager {

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

    //
    process_transition(transition,post_body,req) {
        let trans_object = super.process_transition(asset_id,post_body,req)
        //
        if ( G_uploader_trns.tagged(transition) ) {
            trans_object.secondary_action = false
        }
        //
        return(trans_object)
    }

    //
    //
    finalize_transition(transition,post_body,elements,req) {
        if ( G_uploader_trns.tagged(transition) ) {
            return(this.upload_file(post_body,G_uploader_trns,req))
        }
        let finalization_state = {
            "state" : "ERROR",
            "OK" : "false"
        }
        return(finalization_state)
    }
    
}

class UploaderAuth  extends GeneralAuth {
    constructor() {
        super(UploaderSessionManager)   // intializes general authorization with the customized session manager class.
    }
}

var session_checker = new UploaderAuth()
module.exports = session_checker;