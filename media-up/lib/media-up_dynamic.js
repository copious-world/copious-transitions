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
            // send, store
            let send_elements = {}
            if ( trans_object.file_key ) {
                send_elements.match = trans_object.file_key
            }
            return [trans_object.elements,send_elements]
        }
        return [{},{}]
    }

}


module.exports = new MediaUpDynamic()
