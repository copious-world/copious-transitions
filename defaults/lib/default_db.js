const { DBClass, SessionStore } = require.main.require('./lib/general_db')

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class DefaultSessionStore extends SessionStore {
    //
    constructor(db_wrapper) {
        super(db_wrapper)
    }
    //
}



class DefaultDBClass extends DBClass {

    //
    constructor() {
        super(DefaultSessionStore)
    }

}


//
//
module.exports = new DefaultDBClass()
