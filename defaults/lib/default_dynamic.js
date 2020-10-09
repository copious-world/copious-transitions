const GeneralDynamic = require.main.require('./lib/general_dynamic')

const myStorageClass = null
//
class DefaultDynamic extends GeneralDynamic {
    //
    constructor() {
        super(myStorageClass)
    }
}

    

module.exports = new DefaultDynamic()
