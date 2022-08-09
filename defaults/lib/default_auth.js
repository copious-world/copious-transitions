//
const { GeneralAuth, SessionManager } = require('../../index')


class DefaultSessionManager extends SessionManager {

    constructor(exp_app,db_obj,business) {
        //
        super(exp_app,db_obj,business)         //
        //  ----  ----  ----  ----  ----  ----  ----  ----  ----
    }
}

class DefaultAuth  extends GeneralAuth {
    constructor() {
        super(DefaultSessionManager)   // intializes general authorization with the customized session manager class.
    }
}

var session_checker = new DefaultAuth()
module.exports = session_checker;


