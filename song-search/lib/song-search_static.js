const GeneralStatic = require('lib/general_static')

const myStorageClass = null

class MediaUpStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
    }
}


module.exports = new MediaUpStatic()
