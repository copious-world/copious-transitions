//
const { GeneralAuth, SessionManager } = require.main.require('./lib/general_auth_session_lite')
const expressSession = require('express-session');
const cookieParser = require('cookie-parser');
const uuid = require('uuid/v4');


class DefaultSessionManager extends SessionManager {

    constructor(exp_app,db_obj,business) {
        //
        super(exp_app,db_obj,business)         //
        //  ----  ----  ----  ----  ----  ----  ----  ----  ----
    }
}

class DefaultAuth  extends GeneralAuth {
    constructor() {
        super(DefaultAuth)   // intializes general authorization with the customized session manager class.
    }
}

var session_checker = new DefaultAuth()
module.exports = session_checker;


