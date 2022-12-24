//const fs =  require('fs')
//const { promisify } = require("util");
const AppLifeCycle = require("./general_lifecyle")
const uuid = require('./uuid')
const fs_pr = require('fs/promises')
//const crypto = require('crypto')

const WSS_PING_INTERVAL = 30000
const DEFAULT_TRANSITION_ENDPOINT = "./transition-endpoint-server"


class ForeignAuthExtension extends AppLifeCycle {

    constructor() {
        super()
    }

    //
    foreign_auth_prep(token) {
        if ( this.going_ws_sessions[token] ) {  // shut down a ws session if there is one
            try {
                this.going_ws_sessions[token].close()
            } catch(e) {
                //
            }
        }
        this.going_ws_sessions[token] = null    
    }

    // 
    foreign_auth_initializer(ws) {
        //
        ws.on("message",  (data) => {
            try {
                let clientIdenifier = JSON.parse(data.toString());
                this.going_ws_sessions[clientIdenifier.token] = ws    // associate the client with the DB    
            } catch (e) {
            }
        });
    
        ws.on("close", () => {
            let token = null
            for ( let tk in this.going_ws_sessions ) {
                if ( this.going_ws_sessions[tk] === ws ) {
                    token = tk
                    break
                }
            }
            if ( token ) {
                delete this.going_ws_sessions[token]
            }
        });
        //
    }

}




// EndpointManager
// especially useful for uploaders or other types of processes that 
// use a backend servrer conversation in order to expose validated endpoints
// to the user facing services (web servers)

class EndpointManager extends ForeignAuthExtension {

    constructor() {
        super()
        this.trans_processor = false
        this.user_processor = false
        this.endpoint_service = false
    }

    initialize_endpoint_services(conf) {
        if ( conf === undefined ) return
        //
        let TransitionalEndpoint = require((conf.endpoint_module !== undefined) ? conf.endpoint_module : DEFAULT_TRANSITION_ENDPOINT)
        this.endpoint_service = new TransitionalEndpoint(conf)
        this.endpoint_service.set_transition_handler(async (transition,msg_obj) => {
            // called from app_message_handler  (see endpoint service message-relay-services)
            let server_id = msg_obj ? msg_obj.server_id : false
            if ( server_id && this.trans_processor ) {      // transitional
                let result = await this.trans_processor.endpoint_transition(transition,msg_obj)
                return result[1]  // this will send back the JSON object without HTTP status codes
            } 
        })
        //
        return {}
    }

}


class WebSocketActions extends EndpointManager {

    constructor() {
        //
        super()

        this.going_sessions = {}
        this.checking_pings = false
        this.supects = {}

        this.going_ws_sessions = {} // map token to web socket
        this.going_ws_sitewide_sessions = {}  // map token to list of web socket

        this.app_wss = false
        this.ws_client_attempt_timeout = null
    }

    set_contractual_filters(trans_processor,user_processor) {
        this.trans_processor = trans_processor
        this.user_processor = user_processor
    }

    //   send_to_ws   -- websocket wrapper
    send_to_ws(ws,data) {
        if ( ws ) {
            try {
                let message = JSON.stringify(data)
                ws.send(message);
            } catch (e) {}
        }
    }

    // APPLICATION WS (COM EXCHAGE)

    setup_app_ws(ws,app_wss) {

        if ( !app_wss ) return
        //
        this.app_wss = app_wss
        this.add_ws_session(ws)

        ws.on("message", async (data) => {
            try {
                let body = JSON.parse(data.toString());
                //
                let server_id = body.message ? body.message.server_id : false
                if ( server_id ) {      // transitional
                    let transition = body.transition
                    this.trans_processor.ws_transition(transition,body.message)
                } else {
                    let ping_id = body.ping_id
                    if ( ping_id ) {
                        let response = await this.ponged(ws)
                        this.send_to_ws(ws,message)
                    }
                }
            } catch (e) {}
        });

        ws.on("close", () => {
            this.close_wss_session(ws)
        });

    }


    // SITEWIDE WS (COM EXCHAGE)
    
    ws_message_handler(data) {
        try {
            let body = JSON.parse(data.toString());
            let ping_id = body.ping_id
            if ( ping_id ) {
                this.ponged(ws)
                return
            }
            // else not a ping
            let token = body.token
            if ( token ) {
                switch ( body.action ) {
                    case 'setup' : {
                        let ws_data = this.going_ws_sitewide_sessions[token]
                        if ( ws_data === undefined ) {
                            this.going_ws_sitewide_sessions[token] = [ ws ]
                        } else {
                            let ws_list = this.going_ws_sitewide_sessions[token]
                            if ( ws_list.indexOf(ws) < 0 ) {
                                ws_list.push(ws)
                            }
                        }    
                        break;
                    }
                    case 'logout' : {
                        let ws_list = this.going_ws_sitewide_sessions[token]
                        let command = {
                            'action' : 'logout',
                            'token' : token
                        }
                        ws_list.forEach(ws => {
                            this.send_to_ws(ws,command)
                        })    
                        break;
                    }
                }
            }
        } catch(e) {
        }
    }

    // 
    ws_shutdown(ws) {
        let token = null
        for ( let tk in going_ws_sessions ) {
            let ws_dex = going_ws_sessions[tk].indexOf(ws)
            if ( ws_dex >= 0 ) {
                token = tk
                going_ws_sessions[token].splice(ws_dex,1)
                break
            }
        }
        if ( token && (going_ws_sessions[token].length == 0) ) {
            delete going_ws_sessions[token]
        }
    }


    ws_connection_attempt(proc_ws_token,sitewide_socket) {
        if ( !sitewide_socket ) {
            console.log(new Error("ERROR: sitewide_socket not available in ws_connection_attempt ... general transition engine "))
            process.exit(1)
        }
        try {
            // setup a webSocket connection to get finalization data on logging in. -- 
            sitewide_socket.on('error',(e) => {
                sitewide_socket = null
                console.log(e.message)
                if (  e.code == 'ECONNREFUSED'|| e.message.indexOf('502') > 0 ) {
                    console.log("try again in 1 seconds")
                    let try_again = () => { this.ws_connection_attempt(proc_ws_token,sitewide_socket) }
                    this.ws_client_attempt_timeout = setTimeout(try_again,1000)
                } else {
                    console.dir(e)
                }
            })
            sitewide_socket.on('open', () => {
                //
                console.log("web sockets connected")
                if ( this.ws_client_attempt_timeout !== null ) {
                    clearTimeout(this.ws_client_attempt_timeout)
                    this.ws_client_attempt_timeout = null
                }
                //
                let msg = {
                    'token' : proc_ws_token,
                    'action' : 'setup'
                }
                sitewide_socket.send(JSON.stringify(msg))
                //
            })
            sitewide_socket.onmessage = async (event) => {	// handle the finalization through the websocket
                try {
                    let handler = JSON.parse(event.data)
                    if ( handler.data && (handler.data.type === 'ping') ) {
                        if ( sitewide_socket ) {
                            let ponger = {
                                "ping_id" : handler.data.ping_id,
                                "time" : Date.now()
                            }
                            sitewide_socket.send(JSON.stringify(ponger))
                        }
                    } else {
                        if ( (handler.token === proc_ws_token) && (this.user_processor && this.user_processor.sitewide_logout)) {
                            if ( handler.action === "logout" ) {
                                await this.user_processor.sitewide_logout(handler)
                            } else {
                                eval(handler.action)
                            }
                        }
                    }
                } catch (e) {
                }
            }
            //
        } catch(e) {
            console.log(e.message)
            console.dir(e)
            process.exit(1)
        }
    }

    send_ws_outofband(token_key,data) {
        if ( token_key ) {
            let ws = this.going_ws_sessions[token_key]
            if ( ws ) {
                this.send_to_ws(ws,data)
            }
        }
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
        let ws = this.going_sessions[ws_id]
        if ( ws ) {
            let message = {
                "ws_id" : ws_id,
                "data" : data
            }
            this.send_to_ws(ws,message)
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

}





class GeneralTransitionEngImpl extends WebSocketActions {
    //
    constructor() {
        super()
        this.db = null
        this.statics = null
        this.dynamics = null
        this._uploader_managers = {}
        this.root_path = process.mainModule.path
    }

    initialize(conf,db) {
        this.conf = conf
        this.db = db
        if ( (conf.transition_endpoint !== undefined) && (typeof conf.transition_endpoint === 'object') ) {
            this.initialize_endpoint_services(conf.transition_endpoint)
        }
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


    async update_meta_descriptors(post_body,ids) {}

    alt_store() { return false }
    app_pack_data(blob_data) {}


    // chunk_mover
    // per file chunk mover
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
            let writeable_data = this.alt_store() ? this.app_pack_data(blob_data) : this.chunks_to_data(blob_data)
            id = await this.store_data(file_descriptor,target_path,writeable_data,id)   
        }
        try {
            if ( cb ) cb()
        } catch (e) {}
        //
        return(id)
    }

    // files_coming_in_chunks
    //  Set up a data structure that can be found by the ...transaction token... 
    //  and that refers to an array that can receive chunks (one or more files as separate cases)
    //  when a file list is givent, the files are keyed by the file name under the transaction token 
    //  -> (file names will not be confused with other sessions)
    files_coming_in_chunks(post_body,token) {
        let chunk_manager = Object.assign({},post_body)
        if ( post_body.file_list ) {            // MULTIPLE FILES. for clients sending more than one file, a list is expected beyond the typical form field list
            chunk_manager._chunkers = {}
            for ( let file of post_body.file_list ) {   // EACH of file list
                chunk_manager._chunkers[file.file_name] = []   // chunks  // each file in the list has to have at least a name
            }
        } else {
            chunk_manager._chunks = []          // ONE FILE only
        }
        this._uploader_managers[token] = chunk_manager    // <-- transaction token gets a chunk manager
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
        let chunk_manager = this._uploader_managers[token]
        if (  (f_keys.length === 1) && chunk_manager._chunks ) {         // Handling one file
            let file = files[f_keys[0]]
            chunk_manager._chunks.push(file.data)
        } else {                            // Handling multiple files
            // in a sequece of chunks one or more files may be identified in the post body
            // the client will seize to send the smaller files while larger ones will be sent 
            // until post bodies indicate that there is no more data to come.
            if ( chunk_manager._chunkers ) {
                for ( let file_key in files ) {
                    let file = files[file_key]
                    let chunk_array = chunk_manager._chunkers[file.name]
                    if ( file ) {
                        chunk_array.push(file.data)
                    }
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
            // the file_list is sent in the body. 
            // they may have fallen out from the upload process.
            // But, it is expected that the client will send the list of all files
            // in the completion post body.
            if ( post_body.file_list ) {        // MORE THAN ONE
                for ( let uploaded_file of post_body.file_list ) {
                    let ext = uploaded_file.ext ? uploaded_file.ext : "media"
                    let file_differentiator = ttrans.file_entry_id("file")
                    let store_name = `${uploaded_file.name}${file_differentiator}.${ext}`
                    let dir = ttrans.directory()
                    //
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
                //
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
            ttrans.update_file_db_entry(udata)
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
                })(udata,req),udata)    
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


module.exports = GeneralTransitionEngImpl
