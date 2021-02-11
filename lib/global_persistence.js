
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
    this.cache = new LRU(conf)
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
}



class PersistenceManager {
    constructor(api_keys) {

        this.persistence_pass = api_keys.persistence_password.trim(); // decrypt ??  // remote password for admin authority... not on this box
        this._LRUManager = new LRUManager(api_keys);
        this._all_senders = []
    }

    get_LRUManager() {
        return(this._LRUManager)
    }

    client_going_down() {
        // 
    }

    post_message(msgObject) {

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
