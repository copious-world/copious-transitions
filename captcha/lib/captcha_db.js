const { DBClass, SessionStore } = require.main.require('./lib/general_db')
//
const PersistenceManager = require.main.require('./lib/global_persistence')
//
const apiKeys = require.main.require('./local/api_keys')
const g_persistence = new PersistenceManager(apiKeys.persistence,apiKeys.message_relays)
const g_ephemeral = new PersistenceManager(apiKeys.session)

const SLOW_MESSAGE_QUERY_INTERVAL = 5000
const FAST_MESSAGE_QUERY_INTERVAL = 1000
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

class CaptchaSessionStore extends SessionStore {
    //
    constructor(db_wrapper) {
        super(db_wrapper)
    }
    //
    generateStore(expressSession) {
        if ( super.can_generate_store(expressSession,true) ) {
            return (g_keyValueSessions)
        } else {
            process.exit(1)
        }
    }
    //
}



class CaptchaDBClass extends DBClass {

    //
    constructor() {
      let persistenceDB = undefined
      super(CaptchaSessionStore,g_keyValueDB,g_keyValueSessions,persistenceDB)
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

    // // // 
    store_user(fdata) {
        if ( G_users_trns.tagged('user') ) {
          let [udata,tandems] = G_users_trns.update(fdata)          // custom user storage (seconday service)
          //G_users_trns.enqueue(tandems)
          //
          let key_key = G_users_trns.kv_store_key()
          let key = udata[key_key]
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
          udata = super.fetch_user(key)  // no callback, just get value
          if ( udata ) {
            this.store_cache(key,udata,G_users_trns.back_ref());
            return(udata)
          }
        }
      }
      return(false)
    }

    update_user(udata) {
      //
      let key_key = G_users_trns.kv_store_key()
      let key = udata[key_key]
      //
      this.store_cache(key,udata,G_users_trns.back_ref());  // this app will use cache to echo persitent storage
      super.update_user(udata,key_key)                               // use persitent storage
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
