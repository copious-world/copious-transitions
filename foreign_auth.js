const fs = require('fs')
const express = require('express')
const passport = require("passport")
const fetch = require('node-fetch');
const crypto = require('crypto')
const uuid = require('uuid/v4')

const DEFAULT_FOREIGN_LOGIN_ATTEMPTS = 10
const g_port = 2009
//
var app = express()

//
//
const conf_obj = load_parameters()                  // configuration parameters to select modules, etc.
const keys = require('./local/api_keys')

load_parameters()

//

const GitHubStrategy = ( keys.openID.in_use ) ? require('passport-github').Strategy : null
const TwitterStrategy = ( keys.openID.in_use ) ? require('passport-twitter').Strategy : null
const GoogleStrategy = ( keys.openID.in_use ) ? require('passport-google-oauth20').Strategy : null
const AmazonStrategy = ( keys.openID.in_use ) ? require('passport-amazon').Strategy : null
const LinkedInStrategy = ( keys.openID.in_use ) ? require('passport-linkedin').Strategy : null
const FacebookStrategy = ( keys.openID.in_use ) ? require('passport-facebook').Strategy : null
const SoundCloudStrategy = ( keys.openID.in_use ) ? require('passport-soundcloud').Strategy : null
const SpotifyStrategy = ( keys.openID.in_use ) ? require('passport-spotify').Strategy : null
//


var g_foreign_authorizer_api_enpoint = conf_obj.foreign_auth.foreign_authorizer_api_enpoint
var g_domain = conf_obj.domain


// OPEN ID -- there is a better way 
if ( OpenIDStrategy ) {
}


// MARKETING
if ( AmazonStrategy ) {
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
    res.redirect("/complete")
  });

}

if ( LinkedInStrategy ) {
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
    res.redirect("/complete")
  });

}


if ( TwitterStrategy ) {
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
    res.redirect("/complete")
  });

}

if ( GoogleStrategy ) {
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
    res.redirect("/complete")
  });

}


if ( FacebookStrategy ) {
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
    res.redirect("/complete")
  });

}

// DEVELOPMENT

  if ( GitHubStrategy ) {
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
    res.redirect("/complete")
  });
}


// MUSIC

if ( SoundCloudStrategy ) {
  passport.use(
    new SoundCloudStrategy({
      clientID: keys.SoundCloud.client_id,
        clientSecret: keys.SoundCloud.client_secret,
        callbackURL: g_foreign_authorizer_api_enpoint + "/soundcloud/callback"
      },
      (accessToken, refreshToken, profile, done)  => {
        try {
          let user = auth_successful(profile, 'github', accessToken, refreshToken)
          done(null,user)
        } catch(e) {
          done(e, null)
        }
      }
  ));

  app.get('/soundcloud', passport.authenticate('soundcloud'));
  app.get('/soundcloud/callback', passport.authenticate('soundcloud'),(req, res, next) => {
    res.redirect("/complete")
  });

}


if ( SpotifyStrategy ) {
  passport.use(
    new SpotifyStrategy(
      {
        clientID: keys.Spotify.client_id,
        clientSecret: keys.Spotify.client_secret,
        callbackURL: g_foreign_authorizer_api_enpoint + "/spotify/callback"
      },
      (accessToken, refreshToken, expires_in, profile, done) =>  {
        try {
          let user = auth_successful(profile, 'github', accessToken, refreshToken)
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
      res.redirect("/complete")
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
    let userKey = req.params.userKey
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
      return(res.redirect(`/fail`)) 
    }
});


app.get('/fail',(req,res) => {
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
  // SEND INFORMATION BACK TO THE WAITING USER SERVICE
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




app.listen(g_port);
