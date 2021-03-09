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

function random_enough_dash_id() {
  let dd = Math.random()*934593411
  dd = Math.floor(dd)
  return("Dash" + dd)
}

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class DashboardDBClass extends DBClass {

    //
    constructor() {
      //
      let persistenceDB = new CustomPersistenceDB(g_persistence.message_fowarding)  // pass app messages to the backend
      let staticDB = new CustomStaticDB(g_persistence.message_fowarding,false,false,"_transition_path")
      //
      let asset_intake = (obj) => {
        this.asset_intake(obj)
      } 
      g_persistence.message_fowarding.subscribe('user-dashboard',{ "source" : "dashboad", "m_path" : "persistence" },asset_intake)
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
      //

      let dash_obj = decodeURIComponent(obj.dashboard) //
      try {
        dash_obj = JSON.parse(dash_obj)
      } catch(e) {
        dash_obj = {}
      }

      dash_obj.email = obj.email
      dash_obj.owner = obj.email
      dash_obj._id = static_dash
      dash_obj.which_dashboard = random_enough_dash_id()
      //
      let extension = {}
      extension._tx_no_remote = true
      extension.email = obj.email
      G_dashboard_trns.update(extension)
      
      this.put_static_store(static_dash,dash_obj,"application/json",extension)  // store it ... means a local file copy... staticDB
    }

}


//
//
module.exports = new DashboardDBClass()
