const WebSocket = require('ws')
const WebSocketServer = WebSocket.Server;
const http = require("http");


const WSS_PING_INTERVAL = 30000

/**
 * The web socket manager handles the lifecycle of one or more websocket servers for communication with the HTTP client.
 * 
 * There are at least two basic types of web socket services provided here:
 * * sitewide session state - manages session awareness across multiple interfaces for a session
 * * transition processing - handles message to do with transtions with respect to a sesson and its transition actions.
 * 
 * Those sessions stored in `going_sessions`, send messages that wrap the message data and included the id made for the session
 * by startup method in this class. 
 * 
 * These message have the following form:
 *
 ```
        let message = {
            "ws_id" : ws_id,
            "data" : data
        }
```
 *
 * In these messages, the stringified data object in *data* is the data that is being relayed.
 * Responses to the message should be keyed with the same id. 
 * 
 * 
 * 
 * @memberof base
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
     * This method takes in a configuration object which should have a `websocket` field.
     * The `websocket` field in turn must have two fields:
     * 
     * * port_names - a list of strings that name ports having meaning to the application.
     * * defs - a map of the port names to port numbers.
     * 
     * The constructor provides default port handlers, "ws_port", "wss_app_port". But, an application may add to these.
     * 
     * This method add websocket servers for each port identified by `port_names`. After each port server is created, 
     * this method calls the port handler corresponding to the port name, passing the web socket server wrapper. 
     * 
     * The port handlers set up the web socket event handlers for fielding messages and errors.
     * 
     * @param {object} conf 
     * @param {object} app 
     */
    initialize(conf,app) {
        this.app = app
        this.conf = conf
        //
        if ( conf && conf.websockets && conf.websocket.port_names ) {
            let port_names = conf.websocket.port_names
            if ( Array.isArray(port_names) && (typeof conf.websocket.defs === 'object') ) {
                let defs = conf.websocket.defs
                for ( let pname of port_names ) {
                    if ( defs[pname] !== undefined ) {
                        let ws = this.add_service(defs[pname])
                        if ( typeof this.port_handlers[pname] === 'function' ) {
                            this.port_handlers[pname](ws)
                        }
                    }
                }        
            }
        }
        //
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

    /**
     * Calls the framework (node.js) createServer method and then creates a new WebSocket wrapper
     * with the server as its parameter. Returns the web socket server wrapper.
     * 
     * @param {number} port 
     * @returns {Object} - WebSocketServer - the web socket server wrapper.
     */
    add_service(port) {
        let server = http.createServer(this.app);
        server.listen(port);
        return new WebSocketServer({server: server});
    }


    /**
     * 
     * This method handles the connection event. This method filters out messages that are not on th `/shared_auth` 
     * path of the web socket. If the connection is on the path, then it completes the connection setup 
     * setting up the handler for events: message, close, error.
     * 
     * @param {object} auth_wss - a web socket handle
     */
    setup_sitewide_ws(auth_wss) {
        auth_wss.on("connection", (ws,req) => {
            if ( req.url.indexOf("/shared_auth") > 0  ) {
                this._setup_sitewide_ws(ws,this.auth_wss)
            }
        });
    }

    //
    /**
     * This method handles the connection event. This method filters out messages that are not on th `/shared_auth` 
     * path of the web socket. If the connection is on the path, then it completes the connection setup 
     * setting up the handler for events: message, close, error.
     * 
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
                this._setup_app_ws(ws,this.app_wss)
            }
        });
    }


    final() {
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    //   send_to_ws   -- websocket wrapper
    /**
     * Given the websocket wrapper with the `send` method, this send data to the connected client.
     * The data must be stringifiable.
     * 
     * @param {object} ws 
     * @param {object} data 
     */
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
     * Sets up a websocket message event handler that can be used the client to run messages through the tokenized transition framework.
     * 
     * The message handler parses the body data, which should be a JSON parseable string. This is parsed into the body of the message.
     * 
     * The body shoud have the following fields:
     * 
     * * message - The message is itself an object with application defined fields. One required field will be `server_id`.
     * * transition - The name of the transition.
     * * ping_id - for ping message
     * 
     * The message handler checks to see if the `server_id` field on the message.
     * If the id is not on the object, this method attempts to treat the message as a 
     * ping/pong message. If the field `server_id` is on the message, then this method calls upon the transition processor's 
     * method, `ws_transition`, which performs similar operations to the HTTP path handler.
     * 
     * The `close` event handler is also set up. This calls `close_wss_session` which remove the descriptor from  the `going_sessions`
     * table.
     * 
     * 
     * @param {object} ws 
     * @param {object} app_wss 
     */
    _setup_app_ws(ws,app_wss) {

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
     * @param {object} auth_wss 
     */
    _setup_sitewide_ws(ws,auth_wss) {
        ws.on("message",() => { this.ws_sitewide_message_handler(ws) })  // data parameter implicit
        ws.on("close",() => { this.ws_shutdown(ws) })
    }
    
    /**
     * Takes the message data and parses as JSON.
     * 
     * If the object produced has a `ping_id`, this method responds to the message by calling `ponged`.
     * 
     * The sitewide websocket server locates the websocket session descriptor by using a token field on th message body.
     * The body must also have an `action` field. This method provides to action handlers, *setup* and *logout*.
     * 
     * The *setup* pathway adds the web socket server wrapper to the `going_ws_sitewide_sessions[token]` array.
     * This method will create the array the first time the token is seen. Ideally, the token will be a session identifier (token),
     * and will keep connections to the websocket clients.
     * 
     * In a browser, different web socket connections for a single session would be the result of
     * opening a number of tabs and windows belonging to the session. When the session is ended, 
     * one window or tab will initiate the logout and the rest of the interfaces will receive the *logout* message 
     * from this handler. 
     * 
     * @param {Buffer} data 
     * @param {object} ws 
     */
    ws_sitewide_message_handler(data,ws) {
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
     * @param {string} proc_ws_token 
     * @param {object} sitewide_socket 
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
                                let t_obj = await this.user_processor.sitewide_logout(handler)
                                if ( sitewide_socket && t_obj ) {
                                    sitewide_socket.send(JSON.stringify(t_obj))  // send all connected windows the logout
                                }
                            } else {
                                try {
                                    eval(handler.action)
                                } catch (e_eval) {
                                }
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
     * This method is a wrapper of the method `send_to_ws`. 
     * This method pertains to transtion handling, and so it requires the transition 
     * token to find the websocket connection wrapper. It sends any data that can be 
     * stringified.
     * 
     * The *outofband* part of the name usually refers to the situation in data is sent 
     * at times other than when a transtion action is being performed or before the action 
     * has been completed.
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
     * Called by _setup_app_ws. 
     * 
     * This method creates an id for the websocket connection and maps the session into `going_sessions`.
     * This method then sends a message to the client indicating that the connection has taken place.
     * 
     * 
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
     * Send a ping message to a single client.
     * 
     * This adds a field to the ws, the socket connection wrapper. The field is `_app_x_isAlive`.
     * A message containing the `_app_x_ws_id` is sent to the client. `_app_x_ws_id` is another
     * field added to the socket connection wrapper and is used to find the connection wrapper in the
     * `going_sessions` table belonging to this class.
     * 
     * 
     * 
     * @param {object} ws - web socket server
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
     * This method must called in response to the ping call in order for the websocket connection to be considered
     * to be alive.
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
     * Closes out a web socket connection.
     * 
     * @param {object} ws - web socket client connection
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
     * Send a message on the identified web sockets.
     * 
     * This method creates a wrapper for the actual data being sent and attach it to the data field of the wrapper.
     * It also puts the id of the wrapper and assigns it as the value to the `ws_id` field of the message.
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
     * Pings the clients to see if they will respond.
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
     * Closes off client connections that are not responding to pings.
     */
    close_suspects() {
        for ( let wsid in this.supects ) {
            let ws = this.supects[wsid]
            delete this.supects[wsid]
            this.close_wss_session(ws) 
        }
    }

    /**
     * Called by `add_ws_session` if it has not yet been called.
     * It is possible it will be called again if at some point it was turned off and if 
     * `add_ws_session` is called.
     * 
     */
    start_checking_pings() {
        this.checking_pings = true
        let self = this
        setTimeout(() => { self.do_pings(self) },WSS_PING_INTERVAL)
        setTimeout(() => { self.close_suspects() },WSS_PING_INTERVAL*2)
    }


}




module.exports = WebSocketManager


