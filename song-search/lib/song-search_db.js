const { DBClass, SessionStore }  = require('lib/general_db')
const crypto = require('crypto')
const EventEmitter = require('events')
const CitadelClient = require('node_citadel')

//
//
const  redis = require("redis")
const RedisStoreFactory = require('connect-redis');


// pre initializatoin
const redClient = redis.createClient();  // leave it to the module to figure out how to connect


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
            let RedisStore = new RedisStoreFactory(expressSession)
            return (new RedisStore({ client: redClient }))
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
