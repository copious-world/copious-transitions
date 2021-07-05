const IPFS = require('ipfs')            // using the IPFS protocol to store data via the local gateway

const { DBClass } = require.main.require('./lib/general_db')
const PersistenceManager = require.main.require('./lib/global_persistence')
const InterPlanetaryContactServices = require('interplanetary_contact_services')
const CustomPersistenceDB = require.main.require('./custom_storage/persistent_db')
const CustomStaticDB = require.main.require('./custom_storage/static_db')
//
const apiKeys = require.main.require('./local/api_keys')
//
//  We may allow the persitence manager to choose the message relay, 
//  or override with the one chosen by the application...
//
// these are memory based regions accessible by other procs on the same machine.
// persistence for these keys are keys lasting between sesssions.
// originally persistence had to do with forwarding messages that the system cares about.
// contacts will be hanlded differently (using interplanetary contact)
// these now have to do with a larger map for a mesh of session awareness
const g_persistence = new InterPlanetaryContactServices(PersistenceManager,apiKeys.persistence,apiKeys.message_relays)
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
          'm_path' : "contact",
          'recipient' : "admin",
          'anonymous' : false, 
          'type' : false,
          'subject' : decodeURIComponent(i_obj.name),
          'author' : i_obj.cid,
          'references' : decodeURIComponent(i_obj.website),
          'text' : decodeURIComponent(i_obj.comment)
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
        this.init_ipfs(conf)
    }

    //  init_ipfs
    async init_ipfs(cnfg) {
        //
        let container_dir = cnfg.ipfs.repo_location
        if ( container_dir == undefined ) {
            let repo_container = require.main.path
            container_dir =  repo_container + "/repos"
        }
        //
        let subdir = cnfg.ipfs.dir
        if ( subdir[0] != '/' ) subdir = ('/' + subdir)
        let repo_dir = container_dir + subdir
        console.log(repo_dir)
        let node = await IPFS.create({
            repo: repo_dir,
            config: {
                Addresses: {
                    Swarm: [
                    `/ip4/0.0.0.0/tcp/${cnfg.ipfs.swarm_tcp}`,
                    `/ip4/127.0.0.1/tcp/${cnfg.ipfs.swarm_ws}/ws`
                    ],
                    API: `/ip4/127.0.0.1/tcp/${cnfg.ipfs.api_port}`,
                    Gateway: `/ip4/127.0.0.1/tcp/${cnfg.ipfs.tcp_gateway}`
                }
            }
        })

        const version = await node.version()
        console.log('Version:', version.version)

        this.ipfs = node
    }


    // ---- ---- ---- ---- ---- ---- ----
    async get_json_from_cid(a_cid) {
      let data = await this.get_complete_file_from_cid(a_cid)
      try {
          let obj = JSON.parse(data)
          return obj
      } catch (e) {
      }
      return false
    }

    // ---- ---- ---- ---- ---- ---- ----
    // get a user from IPFS based on CID id... (this should be the crypto path CID ... the keys are needed for contact)
    // the user is not yet known to service claimed DBs...
    async fetch_user_ipfs(fdata) {
      let a_cid = fdata.cid
      return await this.get_json_from_cid(a_cid)
    }

    async id_hashing(user_txt) {
      let id = await this.ipfs_hasher(user_txt)  // or this.oracular_storage()
      return id
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
          //
          let key_key = G_users_trns.kv_store_key() // application key for key-value store from data object
          let key = udata[key_key]
          let relationship_id = await super.store_user(udata,key_key)                       // use persitent storage
          udata.relationship_id = relationship_id
          // store the user object in two place (faster == cache and slower == persistence)
          this.store_cache(key,udata,G_users_trns.back_ref());  // this app will use cache to echo persitent storage
          return relationship_id
        }
    }

    // // // 
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

    // ---- ---- ---- ---- ---- ---- ----
    async get_complete_file_from_cid(cid) {
      let ipfs = this.ipfs
      let chunks = []
      for await ( const chunk of ipfs.cat(cid) ) {
          chunks.push(chunk)
      }
      let buff = Buffer.concat(chunks)
      let data = buff.toString()
      return data
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
