
const { DBClass } = require.main.require('./lib/general_db')
const {PersistenceManager,InterPlanetaryContactServices} = require('global_persistence')
const CustomPersistenceDB = require.main.require('./custom_storage/persistent_db')
const CustomStaticDB = require.main.require('./custom_storage/static_db')
//
const apiKeys = require.main.require('./local/api_keys')
//
//

// CONFIGURE THE RELAY message_fowarding IN ORDER TO DETERMINE THE OWNERSHIP OF DATA PATHWAYS

//
//  We may allow the persitence manager to choose the message relay, 
//  or override with the one chosen by the application...
//
// these are memory based regions accessible by other procs on the same machine.
// persistence for these keys are keys lasting between sesssions.
// originally persistence had to do with forwarding messages that the system cares about.
// contacts will be hanlded differently (using interplanetary contact)
// these now have to do with a larger map for a mesh of session awareness
const g_persistence = new InterPlanetaryContactServices(apiKeys.ipfs,apiKeys.persistence,apiKeys.message_relays)
// these keys live as long as a session and no longer..
const g_ephemeral = new PersistenceManager(apiKeys.session)

const SLOW_MESSAGE_QUERY_INTERVAL = 5000
const FAST_MESSAGE_QUERY_INTERVAL = 1000
const WRITE_OBJECT_MAP_EVERY_INTERVAL = 1000*60*15  // 15 minutes
const WRITE_UNUSED_LARGE_ENTRIES_EVERY_INTERVAL = 1000*60*60  // ones an hour
//
const g_keyValueDB = g_persistence.get_LRUManager(); // leave it to the module to figure out how to connect
const g_keyValueSessions = g_ephemeral.get_LRUManager();
//
//


async function run_persistence() {   // describe the entry point to super storage
  if ( g_persistence ) {
    let contact_slow = SLOW_MESSAGE_QUERY_INTERVAL
    let contact_fast = FAST_MESSAGE_QUERY_INTERVAL
    let contact_q_holder = G_contact_trns
    //
    let contact_m_handler = (i_obj) => {
        let o_obj = {
          "name" : i_obj.name,
          "user_cid" : i_obj.cid,  // not the clear cid ... from user requesting contact
          "date" : Date.now(),
          "recipient" : apiKeys.ipfs.cid,
          "readers" : false,
          "business" : i_obj.business,
          "attachments" : false,
          "subject" : decodeURIComponent(i_obj.name),
          "message" : decodeURIComponent(i_obj.comment),
          "reply_with" : "default",
          "public_key" : i_obj.public_key,
          "signer_public_key" : i_obj.signer_public_key,
          "nonce"  : gen_nonce()
        }
        return(o_obj)
    }
    //  ADD PARAMETERS TO THE NEW SENDER  (this takes care of interval services and safety checkmarks)
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
      let persistenceDB = new CustomPersistenceDB(g_persistence.message_fowarding,stash_interval,'user')
      stash_interval = WRITE_UNUSED_LARGE_ENTRIES_EVERY_INTERVAL
      let staticDB = new CustomStaticDB(g_persistence.message_fowarding,stash_interval,'user','email')
      //
      super(g_keyValueDB,g_keyValueSessions,persistenceDB,staticDB)
    }

    // // // 
    initialize(conf) {
        super.initialize(conf)
        this.init_ipfs(g_persistence)
    }

    //  init_ipfs
    async init_ipfs(ipfs_node_src) {
      this.ipfs_ref = ipfs_node_src
      this.ipfs = ipfs_node_src.ipfs
    }

    // ---- ---- ---- ---- ---- ---- ----
    // get a user from IPFS based on CID id... (this should be the crypto path CID ... the keys are needed for contact)
    // the user is not yet known to service claimed DBs...
    async fetch_user_ipfs(fdata) {
      let a_cid = fdata.cid
      return await this.ipfs_ref.get_json_from_cid(a_cid)
    }

    async id_hashing(user_txt) {
      let id = await this.ipfs_hasher(user_txt)  // or this.oracular_storage()
      return id
    }

    //  custom: contacts, ...
    async store(collection,data) {
        if ( G_contact_trns.tagged(collection) ) {
          let udata = G_contact_trns.update(data)
          let user_identity = this.fetch_user_ipfs(udata)
          if ( user_identity ) {
            for ( let ky in user_identity ) {
              let val = user_identity[ky]
              udata[ky] = val     // override keys not related to the message
            }
            G_contact_trns.enqueue(udata)  
          }
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
    store_user(fdata,all) {
        if ( G_users_trns.tagged('user') ) {
          let [udata,tandems] = G_users_trns.update(fdata)          // custom user storage (seconday service) clean up fields
          //
          let key_key = G_users_trns.kv_store_key() // application key for key-value store from data object
          let key = udata[key_key]
          if ( all ) {
            let axiom = fdata.public_derivation
            let ucwid = fdata.ucwid
            this.derivation_keys[ucwid] = axiom
          }
          if ( fdata.public_derivation ) delete fdata.public_derivation  // reclaim this space... do no put it in the LRU storage
          // store the user in just the LRU
          this.store_cache(key,udata,G_users_trns.back_ref());  // this app will use cache to echo persitent storage
          return relationship_id
        }
    }

    // // // 
    async fetch_user(fdata,all) {
      if ( G_users_trns.from_cache() ) {
        let udata = await this.fetch_user_from_key_value_store(fdata[G_users_trns.kv_store_key()])
        if ( udata ) {
          if ( all ) {
            udata.public_derivation = this.derivation_keys[udata.ucwid]
          }
          return(udata)
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
      super.update_user(udata,key_key)                      // use persitent storage (change the remotely stored disk record + local cache (static))
    }

    // exists
    // // a bit more severe than fetch... will fail by default when going to persistent storage
    async exists(collection,post_body) {  
        let query = post_body
        if ( G_users_trns.tagged(collection) ) {
            if ( G_users_trns.from_cache() ) {
              // try to find the user in value storage (local LRU or in-house horizontally scaled LRU)
                let udata = await this.fetch_user_from_key_value_store(post_body[G_users_trns.kv_store_key()])
                if ( udata ) {
                    return(true)
                }
            }
            query = G_users_trns.existence_query(post_body)
        }
        // failing a local lookup go to the persistant big database in the sky or nothing
        return(super.exists(collection,query))
    }

    // // // 
    last_step_initalization() {
      run_persistence()
    }


    // // // 
    drop() {
      dropConnections()
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
