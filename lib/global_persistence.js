
const LRU = require('shm-lru-cache')
const {MessageRelayer} = require("message-relay-services")

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

const DFLT_SLOW_MESSAGE_QUERY_INTERVAL = 5000
const DFLT_FAST_MESSAGE_QUERY_INTERVAL = 1000

/*
{
  "lastAccess": 1343846924959,
  "cookie": {
    "originalMaxAge": 172800000,
    "expires": "2012-08-03T18:48:45.144Z",
    "httpOnly": true,
    "path": "/"
  },
  "user": { 
    "name":"waylon",
    "status":"pro"
  }
}
*/

class LRUManager {
  //
  constructor(conf) {
  console.log("LRUManager conf=")
  console.dir(conf)
    conf.module_path = global_module_path.replace('/lib','')
    if ( conf.module_path[conf.module_path-1] ==='/' ) conf.module_path = conf.module_path.substr(0,conf.module_path.length-1)
    conf.cache.module_path = conf.module_path
    this.cache = new LRU(conf.cache)
    this.in_operation = true
  }

  initialize(conf) {
  }

  //
  set(key,value) {
    let sdata = ( typeof value !== 'string' ) ? JSON.stringify(value) : value
    let augmented_hash_token = this.cache.hash(key)
    this.cache.set(augmented_hash_token, sdata)   // store in the LRU cache
    return(augmented_hash_token)    // return the derived key
  }

  hash_set(key,value) {
    let sdata = ( typeof value !== 'string' ) ? JSON.stringify(value) : value
    let augmented_hash_token = this.cache.hash(key)
    let hh_unidentified = this.cache.hasher(sdata)
    this.cache.set(augmented_hash_token, hh_unidentified)   // store in the LRU cache
    return(hh_unidentified)    // return the derived key
  }
  
  //
  delete(key) { // token must have been returned by set () -> augmented_hash_token
    let augmented_hash_token = this.cache.hash(key)
    this.cache.del(augmented_hash_token)
  }

  //
  get(key) {    // token must have been returned by set () -> augmented_hash_token
    let augmented_hash_token = this.cache.hash(key)
    let value = this.cache.get(augmented_hash_token)
    if ( typeof value !== 'string' ) {
      return false
    }
    return value
  }

  //
  disconnect(opt) {
    this.in_operation = false
    return this.cache.disconnect(opt)
  }

}



class PersistenceManager {
//
  constructor(persistence,message_relays) {
    if ( persistence.password ) {
      this.persistence_pass = persistence.password.trim(); // decrypt ??  // remote password for admin authority... not on this box
    }
    this._LRUManager = new LRUManager(persistence);
    this.message_fowarding = (message_relays !== undefined) ? new MessageRelayer(message_relays) : false
    this._all_senders = []
  }

  get_LRUManager() {
    return(this._LRUManager)
  }

  client_going_down() {
    if ( this._LRUManager.in_operation ) {
      this._LRUManager.disconnect()
    }
  }

  post_message(msgObject) {
    if ( this.message_fowarding ) {
      if ( msgObject.m_path === undefined ) {
        msgObject.m_path = "persistence"
      }
      this.message_fowarding.sendMessage(msgObject)  
    }
  }

  add_message_handler(m_handler,q_holder,prf_slow,prf_fast) {

    if ( m_handler === undefined ) return;
    let handler = m_handler
    if ( q_holder === undefined ) return;
    let _q = q_holder
    let slow = DFLT_SLOW_MESSAGE_QUERY_INTERVAL
    if ( prf_slow !== undefined ) slow = prf_slow;
    let fast = DFLT_FAST_MESSAGE_QUERY_INTERVAL
    if ( prf_slow !== undefined ) fast = prf_fast;

    let sender_index = this._all_senders.length

    let message_sender = async () => {
        let m_snder = this._all_senders[sender_index]
        if ( m_snder ) {
            if ( _q.empty_queue() ) {
                setTimeout(() => { m_snder() }, slow )
            } else {
                //
                while ( !(_q.empty_queue()) ) {
                  let datum = _q.get_work()
                  let msgObject = handler(datum)
                  await this.post_message(msgObject)   // message to admin
                }
                setTimeout(() => { m_snder() }, fast )
            }    
        }
    }

    this._all_senders.push(message_sender)

    setTimeout(message_sender,slow)

  }

}


module.exports = PersistenceManager;
