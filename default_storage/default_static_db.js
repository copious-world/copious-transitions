
let LocalStaticDB = require('./static_db')


/**
 * The static DB default wraps the LocalStaticDB class passing defaults to its constructor.
 * In particular, it replaces the messenger object with something that is much lock a mock class
 * user for testing. This is FauxRemoteMessenger, which just makes a table in local memory. 
 * 
 * The result of using this is that the data will not be shared with other processes. Furthemore, 
 * users of this class can expect speed and memory management problems.
 *
 * @memberof DefaultDB
 */
class StaticDBDefault extends LocalStaticDB {

    constructor() {        // eg. message_relay_client
        super()
    }

    async initialize(conf) {
        await super.initialize(conf)
    }

}



module.exports = StaticDBDefault