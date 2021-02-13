const { DBClass, SessionStore } = require.main.require('./lib/general_db')
var MemCacheStoreFactory = require('memorystore')
const PersistenceManager = require.main.require('./lib/global_persistence')
//
const apiKeys = require.main.require('./local/api_keys')
const g_persistence = new PersistenceManager(apiKeys.persistence)

const memcdClient = g_persistence.get_LRUManager(); //new Memcached('localhost:11211');  // leave it to the module to figure out how to connect

//

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class DashboardSessionStore extends SessionStore {
    //
    constructor(db_wrapper) {
        super(db_wrapper)
    }
    //
    generateStore(expressSession) {
        if ( super.can_generate_store(expressSession,true) ) {
          let MemoryStore = new MemCacheStoreFactory(expressSession)
          return (new MemoryStore({
            checkPeriod: 86400000 // prune expired entries every 24h
          }))
      } else {
            process.exit(1)
        }
    }
    //
}



class DashboardDBClass extends DBClass {

    //
    constructor() {
        // sessStorage,keyValueDB,persistentDB
        let persistentDB = undefined
        super(DashboardSessionStore,memcdClient,persistentDB)
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
module.exports = new DashboardDBClass()
