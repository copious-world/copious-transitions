
let StaticContracts = require('./static_db')
let FauxRemoteMessenger = require('./in_proc_faux_messenger')


class PesistenceContracts extends StaticContracts {

    constructor() {        // eg. message_relay_client

        const messenger = new FauxRemoteMessenger()

        super(messenger,false,'static')
    }

    initialize(conf) {
        super.initialize(conf)
    }

}



module.exports = PesistenceContracts