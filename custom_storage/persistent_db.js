
let FilesAndRelays = require('./files_and_relays')


class PesistenceContracts extends FilesAndRelays {

    constructor(messenger) {        // eg. message_relay_client
        super(messenger)
    }

    initialize(conf) {
        super.initialize(conf)
    }

}



module.exports = PesistenceContracts