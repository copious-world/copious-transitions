const GeneralBusiness = require('lib/general_business')

class UploaderBusiness extends GeneralBusiness {
    //
    constructor() {
        //super(myStorageClass)
        this.db = null
        this.rules = null
    }

}

module.exports = new UploaderBusiness()
