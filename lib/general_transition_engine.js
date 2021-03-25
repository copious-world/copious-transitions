//const fs =  require('fs')
//const { promisify } = require("util");
const AppLifeCycle = require("./general_lifecyle")
const uuid = require('uuid/v4')
//const crypto = require('crypto')

const WSS_PING_INTERVAL = 30000

class GeneralTransitionEngImpl extends AppLifeCycle {
    //
    constructor() {
        super()
        this.db = null
        this.statics = null
        this.dynamics = null
        this.sender_fn = null
        this.going_sessions = {}
        this.checking_pings = false
        this.supects = {}
        this.root_path = process.mainModule.path
    }

    initialize(conf,db) {
        this.conf = conf
        this.db = db
    }

    install(statics_assets,dynamics_assets,sessions) {
        this.sessions = sessions
        this.statics = statics_assets
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
        ws._app_x_isAlive = true;
        let ws_id = uuid()
        this.going_sessions[ws_id] = ws
        ws._app_x_ws_id = ws_id
        this.send_ws(ws_id,{ "status" : "connected", "type" : "ws_id" })
        //
        if ( !(this.checking_pings) ) {
            this.start_checking_pings()
        }
    }

    ping(ws) {      // send a message to a client to see if it is up
        ws._app_x_isAlive = false;
        let data = {
            "data" : { "type" : "ping", "ping_id" : ws._app_x_ws_id },
            "time" : Date.now(),
        }
        ws.send(JSON.stringify(data));    
    }

    ponged(ws) {
        ws._app_x_isAlive = true;
        if ( this.supects[ws._app_x_ws_id] ) {
            delete this.supects[ws._app_x_ws_id]
        }
    }

    close_wss_session(ws) {
        let result = false
        if ( ws ) {
            let ws_id =  ws._app_x_ws_id
            try {
                result = ws.close()
            } catch (e) {
            }
            if ( ws_id && this.going_sessions[ws_id]) delete this.going_sessions[ws_id]
        }
        return result
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

    do_pings(caller) {
        for ( let key in this.going_sessions ) {
            let ws = this.going_sessions[key]
            if ( !(ws._app_x_isAlive) ) {
                this.supects[ws._app_x_ws_id] = ws
            } else {
                this.ping(ws)
            }
        }
        setTimeout(() => { caller.do_pings(caller) },WSS_PING_INTERVAL)
    }

    close_suspects() {
        for ( let wsid in this.supects ) {
            let ws = this.supects[wsid]
            delete this.supects[wsid]
            this.close_wss_session(ws) 
        }
    }

    start_checking_pings() {
        this.checking_pings = true
        let self = this
        setTimeout(() => { self.do_pings(self) },WSS_PING_INTERVAL)
        setTimeout(() => { self.close_suspects() },WSS_PING_INTERVAL*2)
    }


    async file_mover(file_descriptor,target_path,cb) {
        file_descriptor.mv(target_path,cb)
        return(Math.floor(Math.random()*10000)) // default random int
    }


    async upload_file(post_body,ttrans,files,req) {
        //
        if ( !files || Object.keys(files).length === 0) {
            let finalization_state = {
                "state" : "failed",
                "OK" : "false"
            }
            return finalization_state
        }
        //
        let ukey = ttrans.primary_key()
        let proto_file_name = post_body[ukey]
        let file_name_base = ttrans.transform_file_name(proto_file_name)
        let ext = post_body.file_type
        //
        let ids =  []
        for ( let file_key in files ) {
            let uploaded_file = files[file_key]
            let file_differentiator = ttrans.file_entry_id(file_key)
            // mv is part of the express.js system
            let store_name = `${file_name_base}${file_differentiator}.${ext}`
            let dir = ttrans.directory()
            let udata = {
                'name' : proto_file_name,
                'id-source' : ukey,
                'id' : proto_file_name,
                'pass' : '',
                'dir' : dir,
                'file' : store_name
            }
            let file_id = await this.file_mover(uploaded_file,dir + '/'  + store_name,((uudata,ureq) => {
                return((err) => {
                    if ( err ) {
                        if ( this.sessions ) {
                            this.sessions.session_accrue_errors("upload",uudata,err,ureq)
                        }
                    } else {
                        this.db.store("upload",uudata)
                    }
                });
            })(udata,req))
            //
            ids.push(file_id)
        }
        let finalization_state = {
            "state" : "stored",
            "OK" : "true",
            "ids" : ids
        }
        return finalization_state
    }
}


exports.GeneralTransitionEngine = GeneralTransitionEngImpl
