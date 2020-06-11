const { GeneralAuth, SessionManager } = require('lib/general_auth')
//

const expressSession = require('express-session');



class CaptchaSessionManager extends SessionManager {

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

    // //
    process_user(user_op,body,req) {
        let transtionObj = super.process_user(user_op,body,req)
        switch ( user_op ) {
            case 'login' : {
                transtionObj.email = body.email
                break
            }
            case 'register' : {
                transtionObj.email = body.email
                break
            }
            default : {
                break
            }
        }
        return(transtionObj)
    }

    //process_asset(asset_id,post_body) {}
    feasible(transition,post_body,req) {                // is the transition something that can be done?
        if ( transition === 'captcha' ) {
            return(true)
        }
        return(super.feasible(transition,post_body,req))
    }

    //
    process_transition(transition,post_body,req) {
        if ( transition === 'captcha' ) {
            post_body._uuid_prefix = 'svg+'
            let trans_object = super.process_transition(asset_id,post_body,req)
            return(trans_object)
        }
        return(super.process_transition(transition,post_body,req))
    }

    //
    match(post_body,transtion_object)  {
        if ( transtion_object.asset_key === 'captcha' ) {
            post_body._t_match_field = post_body.captcha_val
        } else  if ( (body.action === 'login') ||  (body.action === 'register') ) {
            post_body._t_match_field = post_body.match
        } else {
            return false
        }
        return super.match(post_body._t_match_field,transtion_object)
    }

    //
    finalize_transition(transition,post_body,elements) {
        if ( transition === 'captcha' ) {
            if ( post_body._t_match_field ) {
                super.update_session_state('captcha',post_body)
                return('OK')
            }
        }
        return("ERROR")
    }

    //
    update_session_state(transition,session_token,req) {    // req for session cookies if any
        if ( (body.action === 'login') ||  (body.action === 'register') ) {
            this.addSession(req.body.email,session_token)
            res.cookie('copiousToken',session_token, { maxAge: 900000, httpOnly: true });
        } else {
            return super.update_session_state(transition,session_token,req)
        }
        return true
    }

    //
    initialize_session_state(transition,session_token,transtionObj,res) {
        if ( transition === 'user' ) {
            transtionObj._db_session_key = transtionObj.email
            super.initialize_session_state(transition,session_token,transtionObj,res)
        }
    }

}




class CaptchaAuth  extends GeneralAuth {

    constructor() {
        super(CaptchaSessionManager)   // intializes general authorization with the customized session manager class.
    }

}


var session_producer = new CaptchaAuth()


module.exports = session_producer;