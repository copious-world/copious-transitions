const fs = require('fs')
const express = require('express')
const passport = require("passport")
const fetch = require('node-fetch');
const crypto = require('crypto')
const uuid = require('uuid/v4')

const DEFAULT_FOREIGN_LOGIN_ATTEMPTS = 10
//
var app = express()


const OpenIDStrategy = require('passport-openid').Strategy;
const GitHubStrategy = require('passport-github').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const GoogleStrategy = require('passport-google-oauth').OAuthStrategy;
//
//
const conf_obj = load_parameters()                  // configuration parameters to select modules, etc.
const keys = require('local/apikeys')


passport.use(new OpenIDStrategy({
    returnURL: conf_obj.foreign_auth.openID.returnURL,
    realm: conf_obj.foreign_auth.openID.realm
  },
  (identifier, done) => {
    //
  }
));



passport.use(new TwitterStrategy({
        consumerKey: keys.TWITTER_CONSUMER_KEY,
        consumerSecret: keys.TWITTER_CONSUMER_SECRET
    },
    (token, tokenSecret, profile, done) => {
        //
    }
));


passport.use(new GoogleStrategy({
    consumerKey: keys.GOOGLE_CONSUMER_KEY,
    consumerSecret: keys.GOOGLE_CONSUMER_SECRET
  },
  (token, tokenSecret, profile, done) => {
      //
  }
));


var g_foreign_authorizer_api_enpoint = conf_obj.foreign_auth.foreign_authorizer_api_enpoint
var g_domain = conf_obj.domain
var GitHubStrategy = require('passport-github').Strategy;

passport.use(new GitHubStrategy({
      clientID: keys.GITHUB_CLIENT_ID,
      clientSecret: keys.GITHUB_CLIENT_SECRET,
      callbackURL: g_foreign_authorizer_api_enpoint + "/github/callback"
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        let user = auth_successful(profile, 'github', accessToken, refreshToken)
        done(null,user)
      } catch(e) {
        done(e, null)
      }
    }
));

app.get('/fauth/github', passport.authenticate('github'));

app.get('/fauth/github/callback',
  passport.authenticate('github'),(req, res, next) => {
    // Successful authentication, redirect home.
    next()
});


var g_current_auth_attempts = {
  'github' : {},
  'google' : {},
  'twitter' : {},
  'openId' : {}
}
app.get('/fauth/start/:strategy/:userkey/:token',(req,res) => {
    //
    let strategy = req.params.strategy
    let userKey = req.params.userKey
    let token = req.params.token
    //
    if ( strategy && userKey && token ) {
      //
      let stratAttempts = g_current_auth_attempts[strategy]
      let authState = stratAttempts[userKey]
      if ( authState !== undefined ) {
        if ( authState.logged_in ) {
          res.status(200).sendFile(__dirname + "/fauth_logged_in_closer.html")
        } else {
          authState.attempt++
          if ( (authState < conf_obj.foreign_attempts_max) ) {
            authState.when = Date.now()
            return(res.redirect(`/fauth/${strategy}`))
          }
        }
      } else {
        authState = {
          'userKey' : userKey,
          'logged_in' : false,
          'attempt' : 1,
          'token' : token,
          'when' : Date.now()
        }
        stratAttempts[userKey] = authState
        return(res.redirect(`/fauth/${strategy}`))  // keep pumping the browser
      }
      //
    } else {
      return(res.redirect(`/fauth/fail`)) 
    }
});


app.get('/fauth/fail',(req,res) => {
  res.status(200).sendFile(__dirname + "/fauth_fail_closer.html")
})


function auth_successful(profile, strategy, accessToken, refreshToken) {
  let body = profile
  let options =  {
    'method': 'POST',
    'body': body
  }
  try {
    let stratAttempts = g_current_auth_attempts[strategy]
    if ( stratAttempts ) {
      let userKey = null
      let foundUser = body.emails.some((email) => {
        userKey = email.value   // conforms to standard profile layout
        return(userKey in stratAttempts)
      })
      if ( foundUser ) {
        let authState = stratAttempts[userKey]
        authState.attempt = 1
        authState.logged_in = true
        authState.when = Date.now()
        authState.accessToken = accessToken   // OAuth tokens
        authState.refreshToken = refreshToken
      } else {
        throw `unkown user:${body.id}`
      }
    } else {
      throw `unkown:${strategy}`
    }
    //
    body.success = true
    body.token = authState.token  // the token associates this activity with a login attempt.
    //
  } catch (e) {
    options.body.success = false
    console.warn(`No token from ${strategy}`)
  }
  //
  fetch(`https://${g_domain}/users/foreign_login/${body.token}`, options);
  //
}


function load_parameters() {
  let config = "./user-service.conf"
  if ( process.argv[2] !== undefined ) {
      config = process.argv[2];
  }
  try {
      let confJSON = JSON.parse(fs.readFileSync(config,'ascii').toString())
      let module_path = confJSON.module_path
      confJSON.mod_path = {}
      for ( let mname in confJSON.modules ) {
          confJSON.mod_path[mname] = __dirname + '/' + module_path + '/' + confJSON.modules[mname]
      }
      if ( !(confJSON.foreign_attempts_max) ) {
        confJSON.foreign_attempts_max = DEFAULT_FOREIGN_LOGIN_ATTEMPTS
      }
      return(confJSON)
  } catch (e) {
      console.log(e)
      process.exit(1)
  }
}



load_parameters()



/*
var express = require('express');
var passport = require('passport');
var Strategy = require('passport-facebook').Strategy;


// Configure the Facebook strategy for use by Passport.
//
// OAuth 2.0-based strategies require a `verify` function which receives the
// credential (`accessToken`) for accessing the Facebook API on the user's
// behalf, along with the user's profile.  The function must invoke `cb`
// with a user object, which will be set at `req.user` in route handlers after
// authentication.
passport.use(new Strategy({
    clientID: process.env['FACEBOOK_CLIENT_ID'],
    clientSecret: process.env['FACEBOOK_CLIENT_SECRET'],
    callbackURL: '/return'
  },
  function(accessToken, refreshToken, profile, cb) {
    // In this example, the user's Facebook profile is supplied as the user
    // record.  In a production-quality application, the Facebook profile should
    // be associated with a user record in the application's database, which
    // allows for account linking and authentication with other identity
    // providers.
    return cb(null, profile);
  }));


// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  In a
// production-quality application, this would typically be as simple as
// supplying the user ID when serializing, and querying the user record by ID
// from the database when deserializing.  However, due to the fact that this
// example does not have a database, the complete Facebook profile is serialized
// and deserialized.
passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});


// Create a new Express application.
var app = express();

// Configure view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());


// Define routes.
app.get('/',
  function(req, res) {
    res.render('home', { user: req.user });
  });

app.get('/login',
  function(req, res){
    res.render('login');
  });

app.get('/login/facebook',
  passport.authenticate('facebook'));

app.get('/return', 
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res){
    res.render('profile', { user: req.user });
  });

app.listen(process.env['PORT'] || 8080);
*/

/*
let a = {
  "id": "703887",
  "displayName": "Mork Hashimoto",
  "name": {
    "familyName": "Hashimoto",
    "givenName": "Mork"
  },
  "birthday": "0000-01-16",
  "gender": "male",
  "drinker": "heavily",
  "tags": [
    "plaxo guy"
  ],
  "emails": [
    {
      "value": "mhashimoto-04@plaxo.com",
      "type": "work",
      "primary": "true"
    },
    {
      "value": "mhashimoto-04@plaxo.com",
      "type": "home"
    },
    {
      "value": "mhashimoto@plaxo.com",
      "type": "home"
    }
  ],
  "urls": [
    {
      "value": "http://www.seeyellow.com",
      "type": "work"
    },
    {
      "value": "http://www.angryalien.com",
      "type": "home"
    }
  ],
  "phoneNumbers": [
    {
      "value": "KLONDIKE5",
      "type": "work"
    },
    {
      "value": "650-123-4567",
      "type": "mobile"
    }
  ],
  "photos": [
    {
      "value": "http://sample.site.org/photos/12345.jpg",
      "type": "thumbnail"
    }
  ],
  "ims": [
    {
      "value": "plaxodev8",
      "type": "aim"
    }
  ],
  "addresses": [
    {
      "type": "home",
      "streetAddress": "742 Evergreen Terrace\nSuite 123",
      "locality": "Springfield",
      "region": "VT",
      "postalCode": "12345",
      "country": "USA",
      "formatted":
      "742 Evergreen Terrace\nSuite 123\nSpringfield, VT 12345 USA"
    }
  ],
  "organizations": [
    {
      "name": "Burns Worldwide",
      "title": "Head Bee Guy"
    }
  ],
  "accounts": [
    {
      "domain": "plaxo.com",
      "userid": "2706"
    }
  ]
}
*/