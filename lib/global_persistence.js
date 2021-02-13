
const LRU = require('shm-lru-cache')


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
    conf.module_path = global_module_path.replace('/lib','')
    if ( conf.module_path[conf.module_path-1] ==='/' ) conf.module_path = conf.module_path.substr(0,conf.module_path.length-1)
    conf.cache.module_path = conf.module_path
    this.cache = new LRU(conf.cache)
  }

  set(token,value) {
    this.cache.set(token, value)
  }

  delete(token) {
    this.cache.del(token)
  }

  get(key) {
    return this.cache.get(key)
  }
  //
  disconnect(opt) {
    return this.cache.disconnect(opt)
  }
  
}



class PersistenceManager {
//
  constructor(persistence) {
      this.persistence_pass = persistence.password.trim(); // decrypt ??  // remote password for admin authority... not on this box
      this._LRUManager = new LRUManager(persistence);
      this._all_senders = []
  }

  get_LRUManager() {
      return(this._LRUManager)
  }

  client_going_down() {
    // ----
  }

  post_message(msgObject) {
    msgObject.m_path = "persistence"

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
