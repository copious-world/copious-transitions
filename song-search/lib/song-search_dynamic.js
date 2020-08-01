const GeneralDynamic = require.main.require('./lib/general_dynamic')
const fetch = require('node-fetch');
const myStorageClass = null

var request = require('request'); // "Request" library


const keys = require.main.require('./local/api_keys')

var client_id = keys.Spotify.client_id; // Your client id
var client_secret = keys.Spotify.client_secret; // Your secret



// your application requests authorization
var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
    },
    form: {
      grant_type: 'client_credentials'
    },
    json: true
  };
  
  
  var g_spotify_ready = false
  var g_access_token = 'nothing'
  var g_tokenExpireTime = 3600
  var g_tokenTimeoutDelta = 10  // start the request before the token becomes useless.
  //
  function obtainToken(cb) {
    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        console.dir(body);
        // use the access token to access the Spotify Web API
        g_access_token = body.access_token;
        g_tokenExpireTime = body.expires_in
        if ( g_tokenTimeoutDelta >= g_tokenExpireTime ) { // fudge some delta 
          g_tokenTimeoutDelta = Math.floor(g_tokenExpireTime/20)
        }
        setTimeout(() => { obtainToken() }, (g_tokenExpireTime - g_tokenTimeoutDelta)*1000 )
        if ( cb ) {
          cb()
        }
      }
    });
    
  }
  
  function getBaseAccount() {
    var options = {
      url: 'https://api.spotify.com/v1/users/richardleddy',
      headers: {
        'Authorization': 'Bearer ' + g_access_token
      },
      json: true
    };
    request.get(options, function(error, response, body) {
      if ( error ) {
        console.error(error)
        process.exit(1)
      }
      //
      g_spotify_ready = true
      console.dir(body);
    });
  }
  

// your application requests authorization
var SpotifyAuthURL = 'https://accounts.spotify.com/api/token'
var SpofityAuthULock = client_id + ':' + client_secret
var SpofityAuthOptions = {
  method: 'POST',
  headers: {
    'Authorization': 'Basic ' + (Buffer.from(SpofityAuthULock).toString('base64'))
  },
  body: {
    grant_type: 'client_credentials'
  }
};


/*
var g_spotify_ready = false
var g_access_token = 'nothing'
var g_tokenExpireTime = 3600
var g_tokenTimeoutDelta = 10  // start the request before the token becomes useless.
//
async function obtainToken() {
    try {
        const response = await fetch(SpotifyAuthURL, SpofityAuthOptions);
        const json = await response.json();
        //
        g_access_token = json.access_token;
        g_tokenExpireTime = json.expires_in
        if ( g_tokenTimeoutDelta >= g_tokenExpireTime ) { // fudge some delta 
            g_tokenTimeoutDelta = Math.floor(g_tokenExpireTime/20)
        }
        setTimeout(() => { obtainToken() }, (g_tokenExpireTime - g_tokenTimeoutDelta)*1000 )
    } catch (e) {
        console.warn("No token from Spotify")
    }
}

function getBaseAccount() {
    let url = 'https://api.spotify.com/v1/users/richardleddy'
    var options = {
        headers: {
            'Authorization': 'Bearer ' + g_access_token
        },
        json: true
    };
    //
    (async () => {
        const response = await fetch(url,options);
        try {
            const json = await response.json();
            g_spotify_ready = true
            console.log(json);
        } catch(e) {
            console.error(e)
            process.exit(1)      
        }
    })();
    //
}
*/



function relay_app_request(query,offset) {
    //
    let limit = 10
    let market = 'US'
    let coded_query = encodeURIComponent(query)
    var options = {
      url: `https://api.spotify.com/v1/search?q=${coded_query}&type=track%2Cartist&market=${market}&limit=${limit}&offset=${offset}`,
      headers: {
        'Authorization': 'Bearer ' + g_access_token
      },
      json: true
    };
    return new Promise((resolve,reject) => {
        if ( g_access_token === 'nothing' ) resolve({})
        request.get(options, function(error, response, body) {
            if ( error ) reject(error)
            else {
                resolve(body)
            }
        });      
    })
  }


  /*
async function relay_app_request(query,offset) {

    if ( g_access_token === 'nothing' ) return({})
    let limit = 10
    let market = 'US'
    let coded_query = encodeURIComponent(query)
    let url = `https://api.spotify.com/v1/search?q=${coded_query}&type=track%2Cartist&market=${market}&limit=${limit}&offset=${offset}`
    var options = {
        headers: {
            'Authorization': 'Bearer ' + g_access_token
        }
    };
    //
    const response = await fetch(url,options);
    try {
        const json = await response.json();
        //g_spotify_ready = true
        return json
    } catch(e) {
        console.error(e)
        return({}) 
    }
    //
}
*/

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
