
import uWS from "uWebSockets.js";


/*
    NoexceptPersistent<Function> upgradePf;
    NoexceptPersistent<Function> openPf;
    NoexceptPersistent<Function> messagePf;
    NoexceptPersistent<Function> drainPf;
    NoexceptPersistent<Function> closePf;
    NoexceptPersistent<Function> droppedPf;
    NoexceptPersistent<Function> pingPf;
    NoexceptPersistent<Function> pongPf;
    NoexceptPersistent<Function> subscriptionPf;
*/

/**
 * wrap a real ws from uWebsockets.js
 */
class WsCTwrapsWS {
    constructor(ws) {
        this.ws = ws
        this._app_x_isAlive = true
        this._app_x_ws_id = ""
    }

    send(message) {
        let ok = this.ws?.send(message,false)       // queue if false
    }

    send_binary(buffer) {
        this.ws?.send(buffer,true)
        
        // let ok = ws.send(message, isBinary);
    }

    ping(message) {
        this.ws?.ping(message)
    }

    close() {
        this.ws?.end(1,"application shut down")
    }
}


/**
 * HTTPWedgeForWebSockets --
 */
class HTTPWedgeForWebSockets {

    constructor() {
        this.ws_to_wrapper = {}
    }

    // especially for the copious-transtitions/lib websockets.js  module
    /**
     * The applications are about the same. Electing to create another uwebsocket for ws pathways
     * 
     * This is called in add_service(port) and should return an object that can listen on a port.
     * 
     * @param {object} app // this is a uWebSocket object wrapper for the html routing... it is a dummy for the uWebSocket application
     * @returns {object} -- a uWebsocket app object ... which can setup http path handlers or a websocket via .ws(params)
     */
    createServer(app) {
        this.ws_app = uWS.App(
        // {
        //   key_file_name: 'misc/key.pem',
        //   cert_file_name: 'misc/cert.pem',
        //   passphrase: '1234'
        // }
        )
        return this
    }


    make_ws_engine(pname,action) {
        //
        let opener = action['open']
        let message_handler = action['message']
        let closer = action['close']
        let ponger = action['pong']

        //
        this.ws_app.ws(`'/${pname}`, {

          /* Options */
          compression: uWS.SHARED_COMPRESSOR,
          maxPayloadLength: 16 * 1024 * 1024,
          idleTimeout: 10,
          /* Handlers */

          open: (ws) => {
            if ( opener ) {
                let ct_ws = new WsCTwrapsWS(ws)
                try {
                    opener(ct_ws)
                    this.ws_to_wrapper[ws] = ct_ws
                    //
                    console.log('A WebSocket connected!');
                } catch (e) {
                    console.log(e)
                }
            }
          },

          message: (ws, data, isBinary) => {
            if ( message_handler ) {
                try {
                    let ct_ws = this.ws_to_wrapper[ws]
                    if ( !isBinary ) {
                        let msg_str = data.toString()
                        let body = JSON.parse(msg_str)
                        if ( body.ping_id === undefined ) {     // this is form older copious-transitions
                            message_handler(ct_ws,body,true)
                        }
                    }
                    /// note that binary is not being handled today...
                } catch(e) {
                    console.log(e)
                }
            }
          },

          drain: (ws) => {
            console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
          },

          close: (ws, code, message) => {
            if ( closer ) {
                try {
                    let ct_ws = this.ws_to_wrapper[ws]
                    closer(ct_ws)
                } catch(e) {
                    console.log(e)
                }
            }
          },

          //ping : () => {},
          pong : (ws, message) => {
            if ( ponger ) {
                try {
                    let ct_ws = this.ws_to_wrapper[ws]
                    ponger(ct_ws)
                } catch(e) {
                    console.log(e)
                }
            }
          }

        })
 
    }

    /**
     * 
     * @param {string} pname 
     * @param {object} action_table -- as a map of handler names to functions (handlers)
     */
    initialize(pname,action_table) {
        try {
            this.make_ws_engine(pname,action_table)
        } catch (e) {
        }
    }
}



module.exports = new HTTPWedgeForWebSockets()
