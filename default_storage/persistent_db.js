
let FilesAndRelays = require('./files_and_relays')

/**
 * @memberof DefaultDB
 */
class PersistenceContracts extends FilesAndRelays {

    constructor(messenger,stash_interval,default_m_path) {        // eg. message_relay_client
        super(messenger,stash_interval,default_m_path)
    }

    initialize(conf) {
        super.initialize(conf)
    }

}



module.exports = PersistenceContracts