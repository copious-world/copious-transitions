const { DBClass, SessionStore }  = require.main.require('./lib/general_db')
const PersistenceManager = require.main.require('./lib/global_persistence')
//
const apiKeys = require.main.require('./local/api_keys')
const g_ephemeral = new PersistenceManager(apiKeys.session)


const g_keyValueDB = g_persistence.get_LRUManager();      // leave it to the module to figure out how to connect
const g_keyValueSessions =  g_ephemeral.get_LRUManager();

const SLOW_MESSAGE_QUERY_INTERVAL = 5000
const FAST_MESSAGE_QUERY_INTERVAL = 1000

//
//

async function dropConnections() {
  if ( g_persistence ) {
    await g_persistence.client_going_down("uploader")
  }
}


async function run_persistence() {   // describe the entry point to super storage
  if ( g_persistence ) {
    let slow = SLOW_MESSAGE_QUERY_INTERVAL
    let fast = FAST_MESSAGE_QUERY_INTERVAL
    let q_holder = G_uploader_trns
    //
    let m_handler = (i_obj) => {
        let udata = i_obj
        let o_obj =  msgObject = {
          'recipient' : "admin",
          'anonymous' : false, 
          'type' : "upload",
          'subject' : decodeURIComponent(udata.name),
          'author' : decodeURIComponent(udata.name),
          'references' : udata.file,
          'text' : `New singer upload: ${udata.name} stored as ${udata.file}`
        }
        return(o_obj)
      }
      //  ADD PARAMETERS TO THE NEW SENDER
      g_persistence.add_message_handler(m_handler,q_holder,slow,fast)
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
      super(UploaderSessionStore,g_keyValueDB,g_keyValueSessions,persistentDB)
    }

    // // // 
    initialize(conf) {
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
      run_persistence()
    }
}


//
//
module.exports = new UploaderDBClass()
