const GeneralBusiness = require.main.require('./lib/general_business')
//const apiKeys = require.main.require('./local/api_keys')
//const myStorageClass = null



class DefaultBusines extends GeneralBusiness {
    //
    constructor() {
        super()
    }
}

    

module.exports = new DefaultBusines()
