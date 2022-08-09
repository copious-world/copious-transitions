const {GeneralDynamic} = require('../../index')

const myStorageClass = null
//
class DefaultDynamic extends GeneralDynamic {
    //
    constructor() {
        super(myStorageClass)
    }
}

    

module.exports = new DefaultDynamic()
