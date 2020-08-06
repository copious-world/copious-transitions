const { DBClass, SessionStore }  = require.main.require('./lib/general_db')
const EventEmitter = require('events')
const CitadelClient = require('node_citadel')
const apiKeys = require.main.require('./local/api_keys')

//
//
const processExists = require('process-exists');
//
var MemcachePlus = require('memcache-plus');

//const apiKeys = require.main.require('./local/api_keys')

// pre initialization

(async () => {
  const exists = await processExists('memcached');
  if ( !exists ) {
    console.log("Memchached deamon has not been intialized")
    process.exit(1)
  }
})();

const memcdClient = new MemcachePlus(); //new Memcached('localhost:11211');  // leave it to the module to figure out how to connect

// pre initialization

var g_citadel = null
var g_citadel_pass = ""
var g_restarting = false

g_citadel_pass = apiKeys.citadel_password.trim()  // decrypt ??

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
  } else if ( G_uploader_trns.empty_queue() ) {
    setTimeout(() => { post_uploader_message() }, 1000 )
  } else {
    let citadel = g_citadel
    //
    while ( g_citadel && !(G_uploader_trns.empty_queue()) ) {
      let udata = G_uploader_trns.get_work()
      await citadel.logout()
      let isNew = await citadel.create_user(udata.name,udata.pass)  // add the user
      await citadel.logout()
      await citadel.user('admin')   // tell admin that it has been done
      await citadel.password(g_citadel_pass)
      let msgObject = {
        'recipient' : "admin",
        'anonymous' : false, 
        'type' : false,
        'subject' : decodeURIComponent(udata.name),
        'author' : decodeURIComponent(udata.name),
        'references' : udata.file,
        'text' : `New singer upload: ${udata.name} stored as ${udata.file}`
      }
      //
      await citadel.post_message(msgObject)   // message to admin
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
}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//
class UploaderDBClass extends DBClass {

    constructor() {
      // sessStorage,keyValueDB,persistentDB
      let persistentDB = undefined
      super(UploaderSessionStore,memcdClient,persistentDB)
    }

    // // // 
    initialize(conf) {
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
            let udata = G_uploader_trns.update(data)
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
