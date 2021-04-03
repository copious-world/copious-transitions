//const fs =  require('fs')
//const { promisify } = require("util");
const AppLifeCycle = require("./general_lifecyle")
const uuid = require('uuid/v4')
const fs_pr = require('fs/promises')
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
        this._uploader_managers = {}
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


    chunks_to_data(blob_data) {
        return Buffer.concat(blob_data)
    }


    async file_mover(file_descriptor,target_path,trans_obj,cb) {
        file_descriptor.mv(target_path,cb)
        return(Math.floor(Math.random()*10000)) // default random int
    }

    async store_data(file_descriptor,target_path,writeable_data,id) {
        await fs_pr.writeFile(target_path,writeable_data)
        return id
    }

    async chunk_mover(token,file_descriptor,target_path,cb) {
        //
        let chunk_manager = this._uploader_managers[token]
        let blob_data = false
        if ( chunk_manager._chunks !== undefined ) {            // ONE FILE -- one array of chunks
            blob_data = chunk_manager._chunks
        } else if ( chunk_manager._chunkers !== undefined ) {       // MANY FILES -- map file names to arrays of chunks
            blob_data = chunk_manager._chunkers[file_descriptor.name]
        } else {
            // COULD NOT PERFORM OP
            return false
        }
        let id = false
        if ( blob_data ) {
            let writeable_data = this.chunks_to_data(blob_data)
            id = await this.store_data(file_descriptor,target_path,writeable_data,id)    
        }
        try {
            if ( cb ) cb()
        } catch (e) {}
        //
        return(id)
    }

    //  Set up a data structure that can be found by the transaction token 
    //  and that refers to an array that can receive chunks (one or more files as separate cases)
    files_coming_in_chunks(post_body,token) {
        let chunk_manager = Object.assign({},post_body)
        if ( post_body.file_list ) {            // MULTIPLE FILES. for clients sending more than one file, a list is expected beyond the typical form field list
            chunk_manager._chunkers = {}
            for ( let file of post_body.file_list ) {
                chunk_manager._chunkers[file.file_name] = []   // chunks  // each file in the list has to have at least a name
            }
        } else {
            chunk_manager._chunks = []          // ONE FILE only
        }
        this._uploader_managers[token] = chunk_manager    
    }

    //
    async upload_chunk(post_body,files) {
        if ( !files || Object.keys(files).length === 0) {
            let finalization_state = {
                "state" : "failed",
                "OK" : false
            }
            return finalization_state
        }
        //
        let token = post_body.token
        let f_keys =  Object.keys(files)
        if (  f_keys.length === 1 ) {         // Handling one file
            let file = files[f_keys[0]]
            let chunk_manager = this._uploader_managers[token]
            chunk_manager._chunks.push(file.data)
        } else {                            // Handling multiple files
            let chunk_manager = this._uploader_managers[token]
            for ( let file_key in files ) {
                let file = files[file_key]
                let chunk_array = chunk_manager._chunkers[file.name]
                if ( file ) {
                    chunk_array.push(file.data)
                }
            }
        }
        let finalization_state = {
            "state" : "next",
            "OK" : true
        }
        return finalization_state
    }


    async chunks_complete(post_body,ttrans) {
        //
        let ids =  []
        let token = post_body.token

        if ( this._uploader_managers[token] !== undefined )  {
            if ( post_body.file_list ) {        // MORE THAN ONE
                for ( let uploaded_file of post_body.file_list ) {
                    let file_differentiator = ttrans.file_entry_id("file")
                    let store_name = `${uploaded_file.name}${file_differentiator}.${ext}`
                    let dir = ttrans.directory()
            
                    let file_id = await this.chunk_mover(token,uploaded_file,dir + '/'  + store_name,false)
                    if ( file_id !== false ) {      // failed transaction will not return identifiers
                        ids.push(file_id)
                    }
                }
            } else {        // JUST ONE
                let uploaded_file = post_body.file
                let ext = post_body.ext ? post_body.ext : "media"
                let file_differentiator = ttrans.file_entry_id("file")
                let store_name = `${uploaded_file.name}${file_differentiator}.${ext}`
                let dir = ttrans.directory()
        
                let file_id = await this.chunk_mover(token,uploaded_file,dir + '/'  + store_name,false)
                if ( file_id !== false ) {      // failed transaction will not return identifiers
                    ids.push(file_id)
                }
            }
        }
        //
        let finalization_state = {
            "state" : "stored",
            "OK" : "true",
            "ids" : ids
        }
        return finalization_state
    }
                

    //
    async upload_file(post_body,ttrans,files,req) {
        //
        if ( !files || Object.keys(files).length === 0) {
            let finalization_state = {
                "state" : "failed",
                "OK" : false
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
            let file_id = await this.file_mover(uploaded_file,dir + '/'  + store_name,ttrans,((uudata,ureq) => {
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
