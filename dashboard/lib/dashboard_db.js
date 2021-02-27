const { DBClass } = require.main.require('./lib/general_db')
const PersistenceManager = require.main.require('./lib/global_persistence')
const CustomPersistenceDB = require.main.require('./custom_storage/persistent_db')
const CustomStaticDB = require.main.require('./custom_storage/static_db')

//
const apiKeys = require.main.require('./local/api_keys')
const g_persistence = new PersistenceManager(apiKeys.persistence,apiKeys.message_relays)
const g_ephemeral = new PersistenceManager(apiKeys.session)


const g_keyValueDB = g_persistence.get_LRUManager();      // leave it to the module to figure out how to connect
const g_keyValueSessions =  g_ephemeral.get_LRUManager();
//

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class DashboardDBClass extends DBClass {

    //
    constructor() {
      //
      let persistenceDB = new CustomPersistenceDB(g_persistence.message_fowarding)  // pass app messages to the backend
      let staticDB = new CustomStaticDB(g_persistence.message_fowarding)
      //
      g_persistence.message_fowarding.subscribe('user-dashboard',this.asset_intake)
      //
      super(g_keyValueDB,g_keyValueSessions,persistenceDB,staticDB)
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


    asset_intake(obj) {   // This object has not been put into static store by the backend. the backned created the file and sent it.
      let static_dash = 'dashboard+' + obj.email 
      this.put_static_store(static_dash,obj,"application/json")  // store it ... means a local file copy... staticDB
    }

}


//
//
module.exports = new DashboardDBClass()
