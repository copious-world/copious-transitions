const GeneralStatic = require.main.require('./lib/general_static')

const myStorageClass = null

class DefaultStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
    }    
}


module.exports = new DefaultStatic()
