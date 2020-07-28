const { DBClass, SessionStore } = require.main.require('./lib/general_db')
const processExists = require('process-exists');
//const EventEmitter = require('events')
//const cached = require('cached')
//
//
const MemCacheStoreFactory = require('connect-memcached');
var MemcachePlus = require('memcache-plus');

//const apiKeys = require.main.require('./local/api_keys')

// pre initialization

(async () => {
  const exists = await processExists('memcached');
  if ( !exists ) {
    console.log("Memchached deamon has not been intialized")
    process.exit(1)
  }
})();

const memcdClient = new MemcachePlus(); //new Memcached('localhost:11211');  // leave it to the module to figure out how to connect

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class UploaderSessionStore extends SessionStore {
    //
    constructor() {
        super()
    }
    //
    generateStore(expressSession) {
        if ( super.can_generate_store(expressSession,true) ) {
            // custom code goes here
            let MemcachedStore = new MemCacheStoreFactory(expressSession)
            return (new MemcachedStore({ client: memcdClient }))
        } else {
            process.exit(1)
        }
    }
    //
}

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//
class UploaderDBClass extends DBClass {

    //
    constructor() {
        super(UploaderSessionStore,redClient)
    }

}

//
//
module.exports = new UploaderDBClass()
