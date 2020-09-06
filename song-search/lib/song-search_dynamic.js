const GeneralDynamic = require.main.require('./lib/general_dynamic')
const fetch = require('node-fetch');
const myStorageClass = null

const keys = require.main.require('./local/api_keys')

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
    constructor(conf) {
        super(conf)
        this.db = null
    }

    async fetch(asset,transtionObj) {
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
        }
        return([]) // empty object, no case matched
    }
    
    initialize(db) {
        this.db = db
        obtainToken(getBaseAccount)
    }
}



module.exports = new SongSearchDynamic()
