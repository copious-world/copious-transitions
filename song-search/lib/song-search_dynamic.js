const GeneralDynamic = require.main.require('./lib/general_dynamic')
const fetch = require('node-fetch');

const myStorageClass = null
const keys = require.main.require('./local/api_keys')

const RETURN_WSS_URL = 'hash_progress_com_wss_url'
const AUDIO_SESSION_TRANSFER  = 'audio-session-transfer'
const GET_PUBLIC_KEY_FOR_KEY_WRAPPING_IN_CLIENT = 'identified_key_wrapper_pub_key'
const GET_PUBLIC_KEY_FOR_RESTORE_KEY_WRAPPING_IN_CLIENT = 'restore_key_wrapper_pub_key'
 
// // //

var client_id = keys.Spotify.client_id; // Your client id
var client_secret = keys.Spotify.client_secret; // Your secret
// application requests authorization
var SpotifyAuthURL = 'https://accounts.spotify.com/api/token'
var SpofityAuthULock = (Buffer.from(`${client_id}:${client_secret}`).toString('base64'))
var SpotifyHeaders = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Authorization': 'Basic ' + SpofityAuthULock
}

var g_spotify_ready = false
var g_access_token = 'nothing'
var g_tokenExpireTime = 3600
var g_tokenTimeoutDelta = 10  // start the request before the token becomes useless.
//
async function obtainToken(cb) {
    try {
      //
      let url = SpotifyAuthURL;
      let headers = SpotifyHeaders
      let data = 'grant_type=client_credentials'
      // 
      let resp = await fetch(url, { 'method': 'POST', 'headers': headers, 'body': data })
      if ( resp ) {
        let body = await resp.json()
        g_access_token = body.access_token;
        g_tokenExpireTime = body.expires_in
        if ( g_tokenTimeoutDelta >= g_tokenExpireTime ) { // fudge some delta 
          g_tokenTimeoutDelta = Math.floor(g_tokenExpireTime/20)
        }
        let next_time = (g_tokenExpireTime - g_tokenTimeoutDelta)*1000
        setTimeout(() => { obtainToken() },next_time)
        if ( cb ) {
          cb()
        }
        //
      }
    } catch (e) {
        console.warn("No token from Spotify")
    }
}


async function getBaseAccount() {
  //
  var url ='https://api.spotify.com/v1/users/richardleddy';
  var headers = {
    "Content-Type": "application/json",
    'Authorization': 'Bearer ' + g_access_token
  }
  //
  let resp = await fetch(url, { method: 'GET', headers: headers })
  if ( resp ) {
    let json = await resp.json()
    console.dir(json);
    g_spotify_ready = true
  }
  //
}


async function relay_app_request(query,offset) {
  //
  let limit = 10
  let market = 'US'
  let coded_query = encodeURIComponent(query)
  //
  let url = `https://api.spotify.com/v1/search?q=${coded_query}&type=track%2Cartist&market=${market}&limit=${limit}&offset=${offset}`
  let headers = {
    "Content-Type": "application/json",
    'Authorization': 'Bearer ' + g_access_token
  }
  //
  let resp = await fetch(url, { 'method': 'GET', 'headers': headers })
  if ( resp ) {
    let json = await resp.json()
    return(json)
  }
}



function selectSpotifyFields(body) {
    if ( body.tracks && body.tracks.items ) {
      let itemList = body.tracks.items
      let page = { current: 0, count : itemList.length }
      let data = itemList.map( item => {
          let name = item.name
          let link = item.external_urls.spotify
          let popularity = item.popularity
          if ( link ) {
              let entry = {
                  'html' : `<a href="${link}" target="SPOTIFY" >${name} :: (${popularity})</a>`,
                  'popularity' : popularity
              }
              return(entry)
          }
      })

      data.sort( (a,b) => {  return(b.popularity - a.popularity) } )

      return [ data, page ]
    } else {
      return []
    }
}


class SongSearchDynamic extends GeneralDynamic {
    //
    constructor() {
        super()
    }
    //
    async initialize(db,conf) {
      this.db = db
      obtainToken(getBaseAccount)
      this.key_location = conf.audio_keys_location
      this.uwrap_key_location = conf.uwrap_audio_keys_location
      this.default_wss = conf.wss
      let key 
      key = await this.load_key(this.key_location)
      this.add_import(key,["wrapKey"],(ky) => { this.audio_sessions_public_key = ky;})
      key = await this.load_key(this.uwrap_key_location)
      this.add_import(key,["unwrapKey"],(ky) => { this.audio_sessions_private_key = ky; })      
    }

    async fetch(asset,transtionObj) {   // override required
        if ( g_spotify_ready && G_spotify_searcher_trns.tagged(asset,'search-results') ) {
            let query = transtionObj.query
            let offset = transtionObj.offset
            if ( query ) {
                try {
                    let data = await relay_app_request(query,offset)
                    let [srch_rslts,page] = selectSpotifyFields(data)
                    //
                    let results = {
                        'mime_type' : 'application/json',
                        'string' : JSON.stringify(srch_rslts)
                    }          
                    return results
                } catch (e) {
                    return ([])
                }
            }

        } else if ( asset === RETURN_WSS_URL) {
          // RETURN A URL FOR SEND WSS MESSAGES TO A COPY OF THIS CHUNK LOGIC
          let email = transtionObj.email
          let invokation_time = transtionObj.when
          let session_data = await this.trans_engine.retrieve_audio_session(email) // find all the device entries if possible
          if ( session_data ) {
            session_data.update({ "timestamp" : invokation_time })
          } else {
            let audioSessionRep = {
              'user' : email,
              'device' : transtionObj.device_id,
              'timestamp' : invokation_time
            }
            let key = {'email' : transtionObj._user_key }
            await this.trans_engine.store_audio_session(key,audioSessionRep)
          }
          let results = {
            'mime_type' : 'application/json',
            'string' : this.default_wss
          }
          return results
        } else if ( asset === AUDIO_SESSION_TRANSFER ) {
          // output the transfer data after checking keys
          let email = transtionObj.email
          let sess_name = transtionObj.sess_name
          let key = {'email' : email }
          let session_data = await this.trans_engine.retrieve_audio_session(email,sess_name)  // with second parameter, identifies a particular recording session
          //
          let results = {
            'mime_type' : 'application/json',
            'string' : session_data
          }
          return results
          //
        } else if ( asset === GET_PUBLIC_KEY_FOR_KEY_WRAPPING_IN_CLIENT ) {    // GET PUBLIC KEY AND MAKE A RECORDING SESSIONS OBJECT
          // TRY TO USE AN EXISTING AUDIO SESS_ID IF THIS EMAIL HAS BEEN USED ON ANOTHER DEVICE
          // NOTE: This branch does not return a named session, just the keys needed to make one
          let rslt = {}
          //
          let key = {'email' : transtionObj._user_key }
          let session_data = await this.trans_engine.retrieve_audio_session(key) // find all the device entries if possible
          //
          let audioSessionRep = session_data ? session_data : {
                                                                'email' : transtionObj._user_key,
                                                                'device' : transtionObj._user_machine_differentiator
                                                              }
          //
          try {
            let wrapper_key = this.audio_sessions_public_key
            let clear_aes_key = await this.trans_engine.create_aes_key()
            //
            let store_wrapped_key = await this.trans_engine.wrap_aes_key(wrapper_key,clear_aes_key)
            let client_wrapper_key = transtionObj._pub_wrapper_key
            if ( client_wrapper_key ) {
              let wrapped_key = await this.trans_engine.wrap_aes_key(client_wrapper_key,clear_aes_key)
              //
              audioSessionRep.wrapped_aes_key = store_wrapped_key
              //
              let sess_id = await this.trans_engine.store_audio_session(key,audioSessionRep)
              rslt = {
                'wrapped' : wrapped_key,   // has been loaded as jwk
                'id' : sess_id
              }
            } else {
              rslt = `{ "status" : "FAIL", "reason" : "no wrapper key for AES"}`
            }  
          } catch (e) {
            rslt = `{ "status" : "FAIL", "reason" : "no wrapper key for AES: ${e.message}"}`
          }
          //
          let results = {
            'mime_type' : 'application/json',
            'string' : JSON.stringify(rslt)
          }       
          return results
        } else if ( asset === GET_PUBLIC_KEY_FOR_RESTORE_KEY_WRAPPING_IN_CLIENT ) {
          let rslt = {}
          //
          let key = {'email' : transtionObj._user_key, 'sess_id' : transtionObj._sess_id }
          let session_data = await this.trans_engine.retrieve_audio_session(key) // find all the device entries if possible
          if ( session_data ) {
            try {
              let unwrapper_key = this.audio_sessions_private_key
              let clear_aes_key = await this.trans_engine.unwrap_aes_key(unwrapper_key,session_data.wrapped_aes_key)
              let client_wrapper_key = transtionObj._pub_wrapper_key
              if ( client_wrapper_key ) {
                let wrapped_key = await this.trans_engine.wrap_aes_key(client_wrapper_key,clear_aes_key)
                rslt = {
                  'wrapped' : wrapped_key,   // has been loaded as jwk
                  'id' : session_data.sess_id
                }
              } else {
                rslt = `{ "status" : "FAIL", "reason" : "no wrapper key for AES"}`
              }
            } catch (e) {
              rslt = `{ "status" : "FAIL", "reason" : "no wrapper key for AES: ${e.message}"}`
            }
          }
          //
          let results = {
            'mime_type' : 'application/json',
            'string' : JSON.stringify(rslt)
          }
          return results
        }
        return([]) // empty object, no case matched
    } 
    
}

module.exports = new SongSearchDynamic()

