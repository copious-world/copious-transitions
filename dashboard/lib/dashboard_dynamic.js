const GeneralDynamic = require.main.require('./lib/general_dynamic')

const myStorageClass = null
//
class DashboardDynamic extends GeneralDynamic {
    //
    constructor() {
        super(myStorageClass)
        this.db = null
    }

    fetch_elements(transition,transtionObj) {
        if ( G_dashboard_trns.tagged(transition,'dynamic') ) {
            let dashboard = {
                'data' : '', 
                'text' : ''
            }
            let send_elements = { 'dashboard' : encodeURIComponent(dashboard.data) }       // send the picture 
            let store_elements = { 'match' : dashboard.text }                          // keep the secret server side
            return [send_elements,store_elements]
        }
        return({}) // empty object, no case matched
    }
    
    initialize(db) {
        this.db = db
    }
}

    

module.exports = new DashboardDynamic()
