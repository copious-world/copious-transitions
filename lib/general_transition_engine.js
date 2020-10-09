//const fs =  require('fs')
//const { promisify } = require("util");
const AppLifeCycle = require("./general_lifecyle")
const uuid = require('uuid/v4')
//const crypto = require('crypto')


class GeneralTransitionEngImpl extends AppLifeCycle {
    //
    constructor() {
        super()
        this.db = null
        this.statics = null
        this.dynamics = null
        this.sender_fn = null
        this.going_sessions = {}
    }

    initialize(conf,db) {
        this.conf = conf
        this.db = db
    }

    install(statics_assetis,dynamics_assets) {
        this.statics = statics_assetis
        this.dynamics = dynamics_assets
        this.statics.set_transition_engine(this)
        this.dynamics.set_transition_engine(this)
        dynamics_assets.import_keys(this.get_import_key_function())
    }

    get_import_key_function() {
        return(false)
    }

    set_wss_sender(sender_fn) {
        this.sender_fn = sender_fn
    }

    add_ws_session(ws) {
        let ws_id = uuid()
        this.going_sessions[ws_id] = ws
        ws._app_x_ws_id = ws_id
        this.send_ws(ws_id,{ "status" : "connected", "type" : "ws_id" })
    }

    close_wss_session(ws) {
        if ( ws ) {
            let ws_id =  ws._app_x_ws_id
            try {
                ws.close()
            } catch (e) {
            }
            if ( ws_id ) delete this.going_sessions[ws_id]
        }
    }

    send_ws(ws_id,data) {
        if ( this.sender_fn ) {
            let ws = this.going_sessions[ws_id]
            if ( ws ) {
                let message = {
                    "ws_id" : ws_id,
                    "data" : data
                }
                ws.send(JSON.stringify(message))
            }
        }
    }

}


exports.GeneralTransitionEngine = GeneralTransitionEngImpl
