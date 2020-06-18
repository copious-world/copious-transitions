const { DBClass, SessionStore }  = require('lib/general_db')
const crypto = require('crypto')
const EventEmitter = require('events')
const CitadelClient = require('node_citadel')
const apiKeys = require('local/aipkeys')
g_citadel_pass = apiKeys.citadel_password.trim()  // decrypt ??

//
//
const  redis = require("redis")
const RedisStoreFactory = require('connect-redis');



// pre initializatoin
const redClient = redis.createClient();  // leave it to the module to figure out how to connect

var g_citadel = null
var g_citadel_pass = ""
var g_restarting = false


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


async function post_uploader_message() {
  if ( g_restarting ) {
    setTimeout(() => { post_uploader_message() }, 200 )
  } else if ( G_contact_trns.empty_queue() ) {
    setTimeout(() => { post_uploader_message() }, 1000 )
  } else {
    let citadel = g_citadel
    //
    while ( g_citadel && !(G_uploader_trns.empty_queue()) ) {
      let udata = G_uploader_trns.get_work()
      await citadel.logout()
      let isNew = await citadel.create_user(udata.name,udata.password)
      await citadel.logout()
      await citadel.user('admin')
      await citadel.password(g_citadel_pass)
      let msgObject = {
        'recipient' : "admin",
        'anonymous' : false, 
        'type' : false,
        'subject' : decodeURIComponent(udata.name),
        'author' : decodeURIComponent(udata.email),
        'references' : udata.file,
        'text' : `New singer upload: ${udata.email} stored as ${udata.file}`
      }
      //
      await citadel.post_message(msgObject)
    }
    setTimeout(() => { post_uploader_message() }, 1000 )
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

class UploaderSessionStore extends SessionStore {
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


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//
class UploaderDBClass extends DBClass {

    //
    constructor() {
        super(UploaderSessionStore,redClient)
    }

    // // // 
    initialize(conf) {
        setTimeout(post_new_user,5000)
        setTimeout(post_uploader_message,5000)
        super.initialize(conf)
    }

    // // // 
    drop() {
        dropConnections()
    }

    //  custom: contacts, ...
    store(collection,data) {
        if ( G_uploader_trns.tagged(collection) ) {
            let udata = G_uploader_trns.update(data,token)
            G_uploader_trns.enqueue(udata)
        } else {
            super.store(collection,data)
        }
    }

    // // // 
    store_user(udata) {
      super.store_user(udata)                               // use persitent storage
    }

    // // // 
    last_step_initalization() {
        run_citadel()
    }
}


//
//
module.exports = new UploaderDBClass()
