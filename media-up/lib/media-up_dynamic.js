const GeneralDynamic = require.main.require('./lib/general_dynamic')

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

    fetch_elements(asset,trans_object) {
        if ( "do_param_upload" === asset ) {
            return [trans_object.elements,{}]
        }
        return [{},{}]
    }

}


module.exports = new MediaUpDynamic()
