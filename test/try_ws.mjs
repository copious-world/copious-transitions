

import WebSocketManager from "../lib/websocket.js"
import uWS from "uWebSockets.js";


let wsM = new WebSocketManager()


const app = uWS.App(
// {
//   key_file_name: 'misc/key.pem',
//   cert_file_name: 'misc/cert.pem',
//   passphrase: '1234'
// }
)

let conf = {
    "web_sockets" : {
        "web_socket_server_class" : "test",
        "http_module" : false,
        "ports" : {
            "port_names" : [ "transitional", "auth" ],
            "defs" : {
                "transitional" : 20,
                "auth" : 30
            }
        },
        "http_module"  : "uct_http_module"
    }
}


console.dir(wsM)


wsM.initialize(conf,app)

