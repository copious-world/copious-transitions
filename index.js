// ----

const CopiousTransitions = require('./user_service_class')

module.exports = CopiousTransitions

// AUTH ----

// will expose {GeneralAuth,SessionManager,SessionManager_Lite}
let { GeneralAuth, SessionManager } = require('./lib/general_auth')
module.exports.GeneralAuth = GeneralAuth
module.exports.SessionManager = SessionManager
module.exports.SessionManager_Lite = require('./lib/general_auth_session_lite')
//
module.exports.GeneralMiddleWare = require('./lib/general_mware')
module.exports._set_conf_and_return = require('./lib/general_express')

// Transtitions - custom operations and custom global variables
module.exports.GeneralTransitionEngine = require('./lib/general_transition_engine')
module.exports.TaggedTransition = require('./lib/tagged_transitions')

module.exports.WebSocketManager = require('./lib/websocket')
module.exports.EndPointServer = require('./lib/general_endpoint_server')
module.exports.LinkManager = require('./lib/general_link_manager')

// ---- ----  ----  ----  ---- 
module.exports.DBClass = require('./lib/general_db')
module.exports.GeneralDynamic = require('./lib/general_dynamic')
module.exports.GeneralStatic = require('./lib/general_static')
module.exports.GeneralBusiness = require('./lib/general_business')

// ---- ----  ----  ----  ---- 
module.exports.GeneralValidator = require('./lib/general_validator')
module.exports.ShutdownManager = require('./lib/shutdown-manager')

// ---- ----  ----  ----  ---- creates instances
module.exports.DefaultPersistenceDB = require('./default_storage/default_persistent_db')
module.exports.DefaultStaticDB = require('./default_storage/default_static_db')
module.exports.DefaultKeyValueDB = require('./default_storage/key_value_db')
module.exports.DefaultNoShareSessionTable = require('./default_storage/session_table_no_sharing')

module.exports.GeneralLifeCycleManager = require('./lib/general_lifecyle')
