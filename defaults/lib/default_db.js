const { DBClass, SessionStore } = require.main.require('./lib/general_db')

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class DashboardSessionStore extends SessionStore {
    //
    constructor(db_wrapper) {
        super(db_wrapper)
    }
    //
}



class DashboardDBClass extends DBClass {

    //
    constructor() {
        super(DashboardSessionStore)
    }

}


//
//
module.exports = new DashboardDBClass()
