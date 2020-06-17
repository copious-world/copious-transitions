const { GeneralAuth, SessionManager } = require('lib/general_auth')
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
    feasible(transition,post_body,req) {                // is the transition something that can be done?
        if (  G_captcha_trns.tagged(transition) || G_contact_trns.tagged(transition) ) {
            return(true)
        }
        return(super.feasible(transition,post_body,req))
    }

    //
    process_transition(transition,post_body,req) {
        let trans_object = super.process_transition(asset_id,post_body,req)
        //
        if ( G_captcha_trns.tagged(transition) ) {
            post_body._uuid_prefix =  G_captcha_trns.uuid_prefix()
        } else if ( G_uploader_trns.tagged(transition) ) {
            trans_object.secondary_action = false
        }
        //
        return(trans_object)
    }

    //
    match(post_body,transtion_object)  {
        if ( G_captcha_trns.tagged(transtion_object.tobj.asset_key) ) {
            post_body._t_match_field = post_body[G_captcha_trns.match_key()]
        } else {
            return false
        }
        return super.match(post_body._t_match_field,transtion_object)
    }

    //
    finalize_transition(transition,post_body,elements,req) {
        if ( G_captcha_trns.tagged(transition) ) {
            if ( post_body._t_match_field ) {
                super.update_session_state(transition,post_body,req)
                let finalization_state = {
                    "state" : "captcha-in-flight",
                    "OK" : "true"
                }    
                return(finalization_state)
            }
        } else if ( G_uploader_trns.tagged(transition) ) {
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

var session_producer = new UploaderAuth()
module.exports = session_producer;