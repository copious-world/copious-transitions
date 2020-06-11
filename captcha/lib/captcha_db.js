const { DBClass, SessionStore }  = require('lib/general_db')
const crypto = require('crypto')
const EventEmitter = require('events')
const CitadelClient = require('node_citadel')

//
//
const  redis = require("redis")
const RedisStoreFactory = require('connect-redis');



// pre initializatoin
const redClient = redis.createClient();  // leave it to the module to figure out how to connect


var g_citadel_pass = ""
var g_restarting = false
var g_user_queue = []


//
//
class CitadelRestarter extends EventEmitter {
    constructor() {
      super()
      this.on('restart',() => {
        console.log("restarting connection")
        g_restarting = true
        run_citadel()
      })
    }
}


//
//
async function run_citadel() {
    let citadel = new CitadelClient()
  
    await citadel.connect()
    console.log("citadel connected")
    let time_data = await citadel.server_time()
    console.log(time_data.split('\n')[0])
    //
    citadel.set_restart_agent(new CitadelRestarter())
    // 
    g_citadel = citadel
    g_restarting = false
}

//
//
async function post_new_user() {
  if ( g_restarting ) {
    setTimeout(() => { post_new_user() }, 200 )
  } else if ( (g_user_queue.length === 0) ) {
    setTimeout(() => { post_new_user() }, 1000 )
  } else {
    //
    while ( g_citadel && (g_user_queue.length > 0) ) {
      let udata = g_user_queue.shift()
      let isNew = await g_citadel.create_user(udata.name,udata.pass)
      await g_citadel.logout()
    }
    setTimeout(() => { post_new_user() }, 1000 )
    //
  }
}



async function dropConnections() {
  if ( g_citadel ) {
    await g_citadel.logout()
    g_citadel.quit()
  }
}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class CaptchaSessionStore extends SessionStore {
    //
    constructor() {
        super()
    }
    //
    generateStore(expressSession) {
        if ( super.can_generate_store(expressSession,true) ) {
            // custom code goes here
            let RedisStore = new RedisStoreFactory(expressSession)
            return (new RedisStore({ client: redClient }))
        } else {
            process.exit(1)
        }
    }
    //
}



class CaptchaDBClass extends DBClass {

    //
    constructor() {
        super(CaptchaSessionStore,redClient)
    }

    // // // 
    initialize(conf) {
        g_citadel_pass = conf.citadel_password.trim()  // decrypt ??
        setTimeout(post_new_user,5000)
        super.initialize(conf)
    }

    // // // 
    drop() {
        dropConnections()
    }

    // // // 
    store_user(udata) {
        if ( g_citadel ) {
            g_user_queue.push(udata)  // for citadel interface
            g_newSignUps[email] = body;
        }
        this.storeCache(email,body);
    }

    // // // 
    fetch_user(identifer) {

    }

    storeCache(email,body) {
        const hash = crypto.createHash('sha256');
        hash.update(email);
        let ehash = hash.digest('hex');
        //
        let user_id = body.user_id;
        this.set_key_value(ehash,JSON.stringify(body))
        this.set_key_value(user_id,ehash)
    }


    async loadUser(user_id,cbUserLoaded) {
        if ( user_id == undefined ) return(false);
        try {
            let ehash = await this.get_key_value(user_id)
            try {
                let u_data = await this.get_key_value(ehash)
                return JSON.parse(u_data)
            } catch (e) {
                return [false,"unknown"]
            }
        } catch(e) {
            return [false,"unknown"]
        }
    }


    async cacheStored(email,body) {
        const hash = crypto.createHash('sha256');
        hash.update(email);
        let ehash = hash.digest('hex');
        try {
            let data = this.get_key_value(ehash)
            return JSON.parse(data)
        } catch(e) {
            return body
        }
    }
    

    exists(collection,post_body) {
        let query = post_body
        if ( collection != 'user' ) {
            if ( g_newSignUps[email] ) {
                return(true)
            } // else
            query = { "email" : post_body.email }
        }
        return(super.exists(collection,query))
    }

    // // // 
    last_step_initalization() {
        run_citadel()
    }
}


//
//
module.exports = new CaptchaDBClass()
