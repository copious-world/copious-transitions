const fs = require('fs')
const express = require('express')
const passport = require('passport')
const fetch = require('node-fetch');
const session = require('express-session');
//
const DEFAULT_FOREIGN_LOGIN_ATTEMPTS = 10

//
var app = express()
app.use(session({
  secret: 's3cr3t',
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((obj, cb) => {
  cb(null, obj);
});

//
//
const conf_obj = load_parameters()                  // configuration parameters to select modules, etc.
const keys = require('./local/api_keys')

const g_port = conf_obj.foreign_auth_port ? conf_obj.foreign_auth_port : 2009

//
const GitHubStrategy = ( keys.GitHub.in_use ) ? require('passport-github').Strategy : null
const TwitterStrategy = ( keys.Twitter.in_use ) ? require('passport-twitter').Strategy : null
const GoogleStrategy = ( keys.Google.in_use ) ? require('passport-google-oauth20').Strategy : null
const AmazonStrategy = ( keys.Amazon.in_use ) ? require('passport-amazon').Strategy : null
const LinkedInStrategy = ( keys.LinkedIn.in_use ) ? require('passport-linkedin').Strategy : null
const FacebookStrategy = ( keys.Facebook.in_use ) ? require('passport-facebook').Strategy : null
const SoundCloudStrategy = ( keys.SoundCloud.in_use ) ? require('passport-soundcloud').Strategy : null
const SpotifyStrategy = ( keys.Spotify.in_use ) ? require('passport-spotify').Strategy : null
//


var g_foreign_authorizer_api_enpoint = conf_obj.foreign_authorizer_api_enpoint
var g_domain = 'www.' + conf_obj.domain


// OPEN ID -- there is a better way 
if ( keys.openID.in_use ) {
}


// MARKETING
if ( AmazonStrategy ) {
  console.log("Setting up AmazonStrategy")
  passport.use(
    new AmazonStrategy({
        clientID: keys.Amazon.client_id,
        clientSecret: keys.Amazon.client_secret,
        callbackURL: g_foreign_authorizer_api_enpoint + "/amazon/callback"
      },
      (accessToken, refreshToken, profile, done) => {
        try {
          let user = auth_successful(profile, 'amazon', accessToken, refreshToken)
          done(null,user)
        } catch(e) {
          done(e, null)
        }
      }
  ));
  
  app.get('/amazon', passport.authenticate('amazon'));
  app.get('/amazon/callback', passport.authenticate('amazon'),(req, res, next) => {
    res.redirect("/fauth/complete")
  });

}

if ( LinkedInStrategy ) {
  console.log("Setting up LinkedInStrategy")
  passport.use(
    new LinkedInStrategy({
        consumerKey: keys.LinkedIn.client_id,
        consumerSecret: keys.LinkedIn.client_secret,
        callbackURL: g_foreign_authorizer_api_enpoint + "/linkedin/callback"
      },
      (token, tokenSecret, profile, done) => {
        try {
          let user = auth_successful(profile, 'linkedin', token, tokenSecret)
          done(null,user)
        } catch(e) {
          done(e, null)
        }
      }
  ));

  app.get('/linkedin', passport.authenticate('linkedin'));
  app.get('/linkedin/callback', passport.authenticate('linkedin'),(req, res, next) => {
    res.redirect("/fauth/complete")
  });

}


if ( TwitterStrategy ) {
  console.log("Setting up TwitterStrategy")
  passport.use(
    new TwitterStrategy({
        consumerKey: keys.Twitter.client_id,
        consumerSecret: keys.Twitter.client_secret,
        callbackURL: g_foreign_authorizer_api_enpoint + "/twitter/callback"
      },
      (token, tokenSecret, profile, done) => {
        try {
          let user = auth_successful(profile, 'twitter', token, tokenSecret)
          done(null,user)
        } catch(e) {
          done(e, null)
        }
      }
  ));

  app.get('/twitter', passport.authenticate('twitter'));
  app.get('/twitter/callback', passport.authenticate('twitter'),(req, res, next) => {
    res.redirect("/fauth/complete")
  });
}

if ( GoogleStrategy ) {
  console.log("Setting up GoogleStrategy")
  passport.use(
    new GoogleStrategy({
        consumerKey: keys.Google.client_id,
        consumerSecret: keys.Google.client_secret,
        callbackURL: g_foreign_authorizer_api_enpoint + "/google/callback"
      },
      (accessToken, refreshToken, profile, done) => {
        try {
          let user = auth_successful(profile, 'google', accessToken, refreshToken)
          done(null,user)
        } catch(e) {
          done(e, null)
        }
      }
  ));

  app.get('/google', passport.authenticate('google'));
  app.get('/google/callback', passport.authenticate('google'),(req, res, next) => {
    res.redirect("/fauth/complete")
  });

}


if ( FacebookStrategy ) {
  console.log("Setting up FacebookStrategy")
  passport.use(
    new FacebookStrategy({
        clientID: keys.Facebook.client_id,
        clientSecret:  keys.Facebook.client_secret,
        callbackURL: g_foreign_authorizer_api_enpoint + "/facebook/callback"
      },
      (accessToken, refreshToken, profile, done) => {
        try {
          let user = auth_successful(profile, 'facebook', accessToken, refreshToken)
          done(null,user)
        } catch(e) {
          done(e, null)
        }
      }
  ));

  app.get('/facebook', passport.authenticate('facebook'));
  app.get('/facebook/callback', passport.authenticate('facebook'),(req, res, next) => {
    res.redirect("/fauth/complete")
  });

}

// DEVELOPMENT

  if ( GitHubStrategy ) {
    console.log("Setting up GitHubStrategy")
    passport.use(
      new GitHubStrategy({
          clientID: keys.GitHub.client_id,
          clientSecret: keys.GitHub.client_secret,
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

  app.get('/github', passport.authenticate('github'));
  app.get('/github/callback', passport.authenticate('github'),(req, res, next) => {
    res.redirect("/fauth/complete")
  });
}



// MUSIC

if ( SoundCloudStrategy ) {
  console.log("Setting up SoundCloudStrategy")
  passport.use(
    new SoundCloudStrategy({
      clientID: keys.SoundCloud.client_id,
        clientSecret: keys.SoundCloud.client_secret,
        callbackURL: g_foreign_authorizer_api_enpoint + "/soundcloud/callback"
      },
      (accessToken, refreshToken, profile, done)  => {
        try {
          let user = auth_successful(profile, 'soundcloud', accessToken, refreshToken)
          done(null,user)
        } catch(e) {
          done(e, null)
        }
      }
  ));

  app.get('/soundcloud', passport.authenticate('soundcloud'));
  app.get('/soundcloud/callback', passport.authenticate('soundcloud'),(req, res, next) => {
    res.redirect("/fauth/complete")
  });

}

//
if ( SpotifyStrategy ) {
  console.log("Setting up SpotifyStrategy")
  passport.use(
    new SpotifyStrategy(
      {
        clientID: keys.Spotify.client_id,
        clientSecret: keys.Spotify.client_secret,
        callbackURL: g_foreign_authorizer_api_enpoint + "/spotify/callback"
      },
      (accessToken, refreshToken, expires_in, profile, done) =>  {
        try {
          let user = auth_successful(profile, 'spotify', accessToken, refreshToken)
          done(null,user)
        } catch(e) {
          done(e, null)
        }
      }
    )
  );

  app.get('/spotify', passport.authenticate('spotify'));
  app.get('/spotify/callback', passport.authenticate('spotify'),(req, res, next) => {
      // Successful authentication, redirect home.
      res.redirect("/fauth/complete")
  });

}




var g_current_auth_attempts = {
  'github' : {},
  'google' : {},
  'twitter' : {},
  'openID' : {},
  "spotify" :  {},
  "soundcloud" : {},
  "amazon" : {},
  "linkedin" : {},
  "facebook" : {}
}

app.get('/start/:strategy/:userkey/:token',(req,res) => {
    //
    let strategy = req.params.strategy
    let userKey = req.params.userkey
    let token = req.params.token
    //
    if ( strategy && userKey && token ) {
      //
      let stratAttempts = g_current_auth_attempts[strategy]
      let authState = stratAttempts[userKey]
      if ( authState !== undefined ) {
        if ( authState.logged_in ) {
          res.status(200).sendFile(__dirname + "/local/fauth_logged_in_closer.html")
        } else {
          authState.attempt++
          if ( (authState.attempt < conf_obj.foreign_attempts_max) ) {
            authState.when = Date.now()
            return(res.redirect(`/fauth/${strategy}`))
          } else {
            return(res.redirect(`/fauth/fail/attempts`)) 
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
      return(res.redirect(`/fauth/fail/no_token`)) 
    }
});


app.get('/fail/:reason',(req,res) => {
  console.log(req.params.reason)
  res.status(200).sendFile(__dirname + "/local/fauth_fail_closer.html")
})

app.get('/complete',(req,res) => {
  res.status(200).sendFile(__dirname + "/local/fauth_success_closer.html")
})

function auth_successful(profile, strategy, accessToken, refreshToken) {
  let body = profile
  let options =  {
    'method': 'POST',
    'body': body
  }
  try {
    let authState = { "token" : "nothing" }
    let stratAttempts = g_current_auth_attempts[strategy]
    if ( stratAttempts ) {
      let userKey = null
      let foundUser = body.emails.some((email) => {
        if ( email.value in stratAttempts ) {
          userKey = email.value   // conforms to standard profile layout
          return(true)
        }
        return(false)
      })
      //
      if ( foundUser ) {
        authState = stratAttempts[userKey]
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
    body.session_token = authState.token
    //
  } catch (e) {
    console.log(e)
    options.body.success = false
    console.warn(`No token from ${strategy}`)
    return(null)
  }
  //
  // SEND INFORMATION BACK TO THE WAITING USER SERVICE
  (async (token)=> {
    console.log(`https://${g_domain}/foreign_login/${token}`)
    await fetch(`https://${g_domain}/foreign_login/${token}`, options);
  })(body.session_token)
  //
  return(body)
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




app.listen(g_port);
