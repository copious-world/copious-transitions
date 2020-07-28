const GeneralDynamic = require('lib/general_dynamic')

const myStorageClass = null

class MediaUpDynamic extends GeneralDynamic {
    //
    constructor(conf) {
        super(conf)
        this.db = null
    }
    
    initialize(db) {
        this.db = db
    }
}


module.exports = new MediaUpDynamic()
