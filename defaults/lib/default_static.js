const {GeneralStatic} = require('../../index')

const myStorageClass = null

class DefaultStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
    }    
}


module.exports = new DefaultStatic()
