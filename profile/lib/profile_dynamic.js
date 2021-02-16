const GeneralDynamic = require.main.require('./lib/general_dynamic')

const myStorageClass = null
//
class ProfileDynamic extends GeneralDynamic {
    //
    constructor() {
        super(myStorageClass)
        this.db = null
    }

    fetch_elements(transition,transtionObj) {
        if ( G_profile_trns.tagged(transition,'dynamic') ) {
            let profile = {
                'data' : '', 
                'text' : ''
            }
            let send_elements = { 'profile' : encodeURIComponent(profile.data) }       // send the picture 
            let store_elements = { 'match' : profile.text }                          // keep the secret server side
            return [send_elements,store_elements]
        }
        return({}) // empty object, no case matched
    }
    
    initialize(db) {
        this.db = db
    }
}

    

module.exports = new ProfileDynamic()
