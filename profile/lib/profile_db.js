const { DBClass, SessionStore } = require.main.require('./lib/general_db')
var MemCacheStoreFactory = require('memorystore')
const PersistenceManager = require.main.require('./lib/global_persistence')
//
const apiKeys = require.main.require('./local/api_keys')
const g_persistence = new PersistenceManager(apiKeys.persistence,apiKeys.message_relays)
const g_ephemeral = new PersistenceManager(apiKeys.session)


const g_keyValueDB = g_persistence.get_LRUManager();      // leave it to the module to figure out how to connect
const g_keyValueSessions =  g_ephemeral.get_LRUManager();


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class ProfileSessionStore extends SessionStore {
  //
  constructor() {
      super()
  }
  //
}




class ProfileDBClass extends DBClass {

    //
    constructor() {
        // sessStorage,keyValueDB,persistentDB
        let persistentDB = undefined
        super(ProfileSessionStore,g_keyValueDB,g_keyValueSessions,persistentDB)
    }

    // // // 
    // // // 
    
    async fetch_user(fdata) {  //  G_users_trns.from_cache()
      let udata = await this.fetch_user_from_key_value_store(fdata[G_users_trns.kv_store_key()])
      if ( udata ) {
        return(udata)
      }
      return(false)
    }

    all_keys(category) {
      return(this.pdb.all_keys(category))
    }

}


//
//
module.exports = new ProfileDBClass()
