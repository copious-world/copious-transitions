const { DBClass } = require('../../index')
//

async function run_persistence() {   // describe the entry point to super storage
}

async function dropConnections() {
}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class CaptchaDBClass extends DBClass {
    //
    constructor() {
      //
      super(false,false,false,false)
      //
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
          if ( this.key_value_db && this.key_value_db.disconnect(true) ) {
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
