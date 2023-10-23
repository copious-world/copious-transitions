const WebSocket = require('ws')
const WebSocketServer = WebSocket.Server;
const http = require("http");


const WSS_PING_INTERVAL = 30000

/**
 * 
 */
class WebSocketManager {

    // 
    constructor() {

        this.going_sessions = {}
        this.checking_pings = false
        this.supects = {}

        this.going_ws_sessions = {} // map token to web socket
        this.going_ws_sitewide_sessions = {}  // map token to list of web socket

        this.app_wss = false
        this.ws_client_attempt_timeout = null

        this.port_handlers = {
            "ws_port" : (auth_wss) => { this.setup_sitewide_ws(auth_wss) } ,
            "wss_app_port" : (app_wss) => { this.setup_app_ws(app_wss) }
        }
    }

    /**
     * 
     * @param {object} conf 
     * @param {object} app 
     * @param {Array} port_names 
     */
    initialize(conf,app,port_names) {
        this.app = app
        this.conf = conf
        //
        for ( let pname of port_names ) {
            if ( conf[pname] !== undefined ) {
                let ws = this.add_service(conf[pname])
                this.port_handlers[pname](ws)
            }
        }
        //
    }


    /**
     * 
     * @param {number} port 
     * @returns {Object} - WebSocketServer
     */
    add_service(port) {
        let server = http.createServer(this.app);
        server.listen(port);
        return new WebSocketServer({server: server});
    }


    /**
     * Sets up a websocket that can be used my multiple client windows so that they may share
     * the state of the server, e.g. with running a session or not.
     * 
     * This method filters out messages that are not on th `shared_auth` path of the web socket.
     * 
     * @param {object} auth_wss - a web socket handle
     */
    setup_sitewide_ws(auth_wss) {
        auth_wss.on("connection", (ws,req) => {
            if ( req.url.indexOf("/shared_auth") > 0  ) {
                this.setup_sitewide_ws(ws,this.auth_wss)
            }
        });
    }

    //
    /**
     * Sets up a websocket that can be used the client to run messages through the tokenized transition framework.
     * 
     * Access may be available to a transition engine that is customized to send data messages (in quasi real time) to
     * the client interfaces.
     * 
     * This method filters out messages that are not on th `transitional` path of the web socket.
     * 
     * @param {object} app_wss - a web socket handle
     */
    setup_app_ws(app_wss) {
        app_wss.on("connection", (ws,req) => {
            if ( req.url.indexOf("/transitional") > 0  ) {
                this.setup_app_ws(ws,this.app_wss)
            }
        });
    }

    /**
     * 
     * @param {object} trans_processor - an instance of the class 
     * @param {object} user_processor 
     * @param {object} mime_processor 
     */
    set_contractual_filters(trans_processor,user_processor,mime_processor) {
        this.trans_processor = trans_processor
        this.user_processor = user_processor
        this.mime_processor = mime_processor
    }


    final() {

    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

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

    /**
     * 
     * @param {object} ws 
     * @param {object} app_wss 
     */
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
                        this.send_to_ws(ws,response)
                    }
                }
            } catch (e) {}
        });

        ws.on("close", () => {
            this.close_wss_session(ws)
        });

    }


    // SITEWIDE WS (COM EXCHAGE)

    /**
     * 
     * @param {object} ws - web socket connection
     * @param {*} auth_wss 
     */
    setup_sitewide_ws(ws,auth_wss) {
        ws.on("message",() => { this.ws_message_handler(ws) })  // data parameter implicit
        ws.on("close",() => { this.ws_shutdown(ws) })
    }
    
    /**
     * 
     * @param {Buffer} data 
     * @param {object} ws 
     */
    ws_message_handler(data,ws) {
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
    /**
     * 
     * @param {object} ws - web socket server
     */
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


    /**
     * 
     * @param {*} proc_ws_token 
     * @param {*} sitewide_socket 
     */
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

    /**
     * 
     * @param {string} token_key - tansition token 
     * @param {object} data 
     */
    send_ws_outofband(token_key,data) {
        if ( token_key ) {
            let ws = this.going_ws_sessions[token_key]
            if ( ws ) {
                this.send_to_ws(ws,data)
            }
        }
    }

    /**
     * 
     * @param {object} ws - web socket server
     */
    add_ws_session(ws) {
        ws._app_x_isAlive = true;
        let ws_id = global_appwide_token()
        this.going_sessions[ws_id] = ws
        ws._app_x_ws_id = ws_id
        this.send_ws(ws_id,{ "status" : "connected", "type" : "ws_id" })
        //
        if ( !(this.checking_pings) ) {
            this.start_checking_pings()
        }
    }

    /**
     * 
     * @param {*} ws - web socket server
     */
    ping(ws) {      // send a message to a client to see if it is up
        ws._app_x_isAlive = false;
        let data = {
            "data" : { "type" : "ping", "ping_id" : ws._app_x_ws_id },
            "time" : Date.now(),
        }
        ws.send(JSON.stringify(data));    
    }

    /**
     * 
     * @param {object} ws - web socket server
     */
    ponged(ws) {
        ws._app_x_isAlive = true;
        if ( this.supects[ws._app_x_ws_id] ) {
            delete this.supects[ws._app_x_ws_id]
        }
    }

    /**
     * 
     * @param {object} ws - web socket server
     * @returns {boolean}
     */
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

    /**
     * send a message on the identified web sockets.
     * 
     * @param {string} ws_id 
     * @param {object} data 
     */
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

    /**
     * 
     * @param {Function} caller 
     */
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

    /**
     * 
     */
    close_suspects() {
        for ( let wsid in this.supects ) {
            let ws = this.supects[wsid]
            delete this.supects[wsid]
            this.close_wss_session(ws) 
        }
    }

    /**
     * 
     */
    start_checking_pings() {
        this.checking_pings = true
        let self = this
        setTimeout(() => { self.do_pings(self) },WSS_PING_INTERVAL)
        setTimeout(() => { self.close_suspects() },WSS_PING_INTERVAL*2)
    }


}




module.exports = new WebSocketManager()


