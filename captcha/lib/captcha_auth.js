const { GeneralAuth, SessionManager } = require('lib/general_auth')
//
const expressSession = require('express-session');
const passport = require("passport")

const OpenIDStrategy = require('passport-openid').Strategy;
const GitHubStrategy = require('passport-github').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const GoogleStrategy = require('passport-google-oauth').OAuthStrategy;

passport.use(new OpenIDStrategy({
    returnURL: 'http://www.example.com/auth/openid/return',
    realm: 'http://www.example.com/'
  },
  (identifier, done) => {
    //
  }
));


passport.use(new GitHubStrategy({
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET
    },
    (accessToken, refreshToken, profile, cb)  => {
        //
    }
));


passport.use(new TwitterStrategy({
        consumerKey: TWITTER_CONSUMER_KEY,
        consumerSecret: TWITTER_CONSUMER_SECRET
    },
    (token, tokenSecret, profile, done) => {
        //
    }
));


passport.use(new GoogleStrategy({
    consumerKey: GOOGLE_CONSUMER_KEY,
    consumerSecret: GOOGLE_CONSUMER_SECRET
  },
  (token, tokenSecret, profile, done) => {
      //
  }
));




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
        if ( G_users_trns.action_selector(user_op) ) {
            let pkey = G_users_trns.primary_key()
            transtionObj[pkey] = body[pkey]
        }
        return(transtionObj)
    }

    ok_forgetfulness(boolVal,transtion_object) {
        transtion_object.forgetfulness_msg = boolVal 
                                                ? "You will receive an email with a link to a password restoration page" 
                                                : "Please try again later"
        transtion_object.forgetfulness_proceed = boolVal
    }


    external_authorizer(req, res, next, cb) {
        passport.authenticate(this.current_auth_strategy, (err, user, info) => {
            if ( err || !user ) { cb(err,null) }
            req.logIn(user, (err) => {   // logIn from passport
              if ( err ) { cb(err,null) }
              else {
                  cb(null,user)
              }
            });
          })(req, res, next);
    }

    extract_exposable_user_info(user,info) {
        return(user.name)
    }

    //
    app_custom_auth(post_body) {  // check that it is in supported strategies
        return( (post_body.strategy !== "local") )
    }

    //
    use_built_in_auth(post_body) {
        return(post_body.strategy === "local")
    }


    //process_asset(asset_id,post_body) {}
    feasible(transition,post_body,req) {                // is the transition something that can be done?
        if (  G_captcha_trns.tagged(transition) || G_contact_trns.tagged(transition) ) {
            return(true)
        } else if ( G_password_reset_trn.tagged(transition ) ) {
            let forgetful_record = this.db.get_key_value(tracking_num)
            if ( forgetful_record ) {
                post_body.email = forgetful_record.email
                return(true)
            }
            return(false)
        }
        return(super.feasible(transition,post_body,req))
    }

    //
    process_transition(transition,post_body,req) {
        let trans_object = super.process_transition(asset_id,post_body,req)
        //
        if ( G_captcha_trns.tagged(transition) ) {
            post_body._uuid_prefix =  G_captcha_trns.uuid_prefix()
        } else if ( G_contact_trns.tagged(transition) ) {
            trans_object.secondary_action = false
        } else if ( G_password_reset_trn.tagged(transition ) ) {
            trans_object.secondary_action = false
        }
        //
        return(trans_object)
    }

    //
    match(post_body,transtion_object)  {
        if ( G_captcha_trns.tagged(transtion_object.tobj.asset_key) ) {
            post_body._t_match_field = post_body[G_captcha_trns.match_key()]
        } else if ( G_users_trns.action_selector(transtion_object.action) ) {
            post_body._t_match_field = post_body[G_users_trns.match_key()]
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
        } else if ( G_contact_trns.tagged(transition) ) {
            this.db.store(transition,post_body)
            let finalization_state = {
                "state" : "stored",
                "OK" : "true"
            }
            return(finalization_state)
        } else if ( G_password_reset_trn.tagged(transition ) ) {
            let reset_info = {
                "password" : post_body.password,
                "email" : post_body.email
            }
            this.db.store_user_secret(reset_info)
            let finalization_state = {
                "state" : "stored",
                "OK" : "true"
            }
            return(finalization_state)
        }

        let finalization_state = {
            "state" : "ERROR",
            "OK" : "false"
        }
        return(finalization_state)
    }

    //
    update_session_state(transition,session_token,req) {    // req for session cookies if any
        if (  G_users_trns.action_selector(body.action) ) {
            this.addSession(req.body.email,session_token)
            res.cookie(this.user_cookie, session_token, { maxAge: 900000, httpOnly: true });
        } else {
            return super.update_session_state(transition,session_token,req)
        }
        return true
    }

    //
    initialize_session_state(transition,session_token,transtionObj,res) {
        if ( G_users_trns.tagged('user') ) {
            transtionObj._db_session_key = transtionObj[G_users_trns.session_key()]
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





   