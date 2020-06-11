const GeneralStatic = require('lib/general_static')

const myStorageClass = null

class CaptchaStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
    }
    
}


module.exports = new CaptchaStatic()
