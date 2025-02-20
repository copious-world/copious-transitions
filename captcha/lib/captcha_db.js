const { DBClass } = require.main.require('./lib/general_db')
const PersistenceManager = require.main.require('./lib/global_persistence')
const DefaultPersistenceDB = require.main.require('./default_storage/persistent_db')
const DefaultStaticDB = require.main.require('./default_storage/static_db')
//
const apiKeys = require.main.require('./local/api_keys')
//
//  We may allow the persitence manager to choose the message relay, 
//  or override with the one chosen by the application...
//
const g_persistence = new PersistenceManager(apiKeys.persistence,apiKeys.message_relays)
const g_ephemeral = new PersistenceManager(apiKeys.session)

const SLOW_MESSAGE_QUERY_INTERVAL = 5000
const FAST_MESSAGE_QUERY_INTERVAL = 1000
const WRITE_OBJECT_MAP_EVERY_INTERVAL = 1000*60*15  // 15 minutes
const WRITE_UNUSED_LARGE_ENTRIES_EVERY_INTERVAL = 1000*60*60  // ones an hour
//
const g_keyValueDB = g_persistence.get_LRUManager(); // leave it to the module to figure out how to connect
const g_keyValueSessions =  g_ephemeral.get_LRUManager();
//
//
async function run_persistence() {   // describe the entry point to super storage
  if ( g_persistence ) {
    let user_slow = SLOW_MESSAGE_QUERY_INTERVAL
    let user_fast = FAST_MESSAGE_QUERY_INTERVAL
    let user_q_holder = G_users_trns
    //
    let user_m_handler = (i_obj) => {
        let o_obj = i_obj
        i_obj.m_path = "user"
        return(o_obj)
      }
      //  ADD PARAMETERS TO THE NEW SENDER
    g_persistence.add_message_handler(user_m_handler,user_q_holder,user_slow,user_fast)

    let contact_slow = SLOW_MESSAGE_QUERY_INTERVAL
    let contact_fast = FAST_MESSAGE_QUERY_INTERVAL
    let contact_q_holder = G_contact_trns
    //
    let contact_m_handler = (i_obj) => {
        let o_obj = {
          'm_path' : "contact",
          'recipient' : "admin",
          'anonymous' : false, 
          'type' : false,
          'subject' : decodeURIComponent(i_obj.name),
          'author' : decodeURIComponent(i_obj.email),
          'references' : decodeURIComponent(i_obj.website),
          'text' : decodeURIComponent(i_obj.comment)
        }
        return(o_obj)
    }
    //  ADD PARAMETERS TO THE NEW SENDER
    g_persistence.add_message_handler(contact_m_handler,contact_q_holder,contact_slow,contact_fast)

  }
}


async function dropConnections() {
  if ( g_persistence ) {
    await g_persistence.client_going_down("captcha")
  }
}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class CaptchaDBClass extends DBClass {
    //
    constructor() {
      // pass app messages to the backend
      let stash_interval = WRITE_OBJECT_MAP_EVERY_INTERVAL
      let persistenceDB = new DefaultPersistenceDB(g_persistence.message_fowarding,stash_interval,'user')
      stash_interval = WRITE_UNUSED_LARGE_ENTRIES_EVERY_INTERVAL
      let staticDB = new DefaultStaticDB(g_persistence.message_fowarding,stash_interval,'user','email')
      super(g_keyValueDB,g_keyValueSessions,persistenceDB,staticDB)
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
        if ( G_contact_trns.tagged(collection) ) {
          let udata = G_contact_trns.update(data)
          G_contact_trns.enqueue(udata)
        } else {
          super.store(collection,data)
        }
    }


    // // FileAndRelays will use the MessageRelayer from global_persistence to send the user data to the backend...
    // // apiKeys = require.main.require('./local/api_keys') configures it...
    // // The relayer may talk to a relay service or an endpoint.... (for captcha, it will be user endpoint...)
    // // the end points are categorical handlers that are tied to message pathways... in this case a 'user' pathway.. 
    // // (see path_handlers.js)

    // // // 
    store_user(fdata) {
        if ( G_users_trns.tagged('user') ) {
          let [udata,tandems] = G_users_trns.update(fdata)          // custom user storage (seconday service) clean up fields
          //G_users_trns.enqueue(tandems)
          //
          let key_key = G_users_trns.kv_store_key() // application key for key-value store from data object
          let key = udata[key_key]
          // store the user object in two place (faster == cache and slower == persistence)
          this.store_cache(key,udata,G_users_trns.back_ref());  // this app will use cache to echo persitent storage
          super.store_user(udata,key_key)                       // use persitent storage
        }
    }

    async fetch_user(fdata) {
      if ( G_users_trns.from_cache() ) {
        let udata = await this.fetch_user_from_key_value_store(fdata[G_users_trns.kv_store_key()])
        if ( udata ) {
          return(udata)
        } else {
          let key_key = G_users_trns.kv_store_key()  // more persistent than the cache
          let key = fdata[key_key]
          udata = await super.fetch_user(key)  // no callback, just get value -- means the user has been entered into storage somewhere...
          if ( udata ) {
            this.store_cache(key,udata,G_users_trns.back_ref());    // from persitence to local cache
            return(udata)
          }
        }
      }
      return(false)     // never saw this user
    }

    update_user(udata) {
      //
      let key_key = G_users_trns.kv_store_key()
      let key = udata[key_key]
      //
      this.store_cache(key,udata,G_users_trns.back_ref());  // this app will use cache to echo persitent storage
      super.update_user(udata,key_key)                      // use persitent storage
    }


    async exists(collection,post_body) {
        let query = post_body
        if ( G_users_trns.tagged(collection) ) {
            if ( G_users_trns.from_cache() ) {
                let udata = await this.fetch_user_from_key_value_store(post_body[G_users_trns.kv_store_key()])
                if ( udata ) {
                    return(true)
                }
            }
            query = G_users_trns.existence_query(post_body)
        }
        return(super.exists(collection,query))
    }

    // // // 
    last_step_initalization() {
      run_persistence()
    }


     //
    disconnect() {
       return new Promise((resolve,reject) => {
          g_persistence.client_going_down()
          if ( g_keyValueDB.disconnect(true) ) {
            resolve(true)
          } else {
            reject(false)
          }
       })
    }

}


//
//
module.exports = new CaptchaDBClass()
