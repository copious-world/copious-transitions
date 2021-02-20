'use strict';
 
// load the Node.js TCP library
const net = require('net');
const PORT = 1234;
const HOST = 'localhost';


const NOISY = true

let g_messenger_connections = {}

//
class Server {
    //
    constructor(conf) {
        this.port = conf ? conf.port || PORT : PORT
        this.address = conf ? conf.address || HOST : HOST
        //
        this.all_topics = {}
        //
        this.init();
    }

    message_complete(msg) {
        try {
            let m_obj = JSON.parse(msg)
            return(m_obj)
        } catch (e) {
            console.log(e)
        }
        return(false)
    }

    //
    add_to_topic(topic,clientName,relayer) {
        let tset = this.all_topics[topic]
        if ( tset == undefined ) {
            tset = {}
            this.all_topics[topic] = tset
        }
        tset[clientName] = relayer
    }

    //
    send_to_all(topic,msg_obj,ignore) {
        let tset = this.all_topics[topic]
        if ( tset ) {
            for ( let t in tset ) {
                let relayer = tset[t]
                if ( (relayer.sock !== ignore) && (relayer.sock.readyState === 'open') ) {
                    let str_msg = JSON.stringify(msg_obj)
                    relayer.sock.write(str_msg)
                }
            }
        }
    }

    remove_from_all_topics(clientName) {
        for ( let topic in this.all_topics ) {
            let tset = this.all_topics[topic]
            if ( tset ) {
                delete tset[clientName]
            }
        }
    }

    init() {
        //
        let server = this;

        let onClientConnected_func = (sock) => {
            // // // 
            let clientName = `${sock.remoteAddress}:${sock.remotePort}`;
            if ( NOISY ) console.log(`new client connected: ${clientName}`);
            //
            g_messenger_connections[clientName] = {
                'sock' : sock,
                'last_message' : ''
            }
            //
            sock.on('data', (data) => {
                let mescon = g_messenger_connections[clientName]
                mescon.last_message += data.toString()
                //
                let msg_obj = server.message_complete(mescon.last_message)
                if (  msg_obj !== false ) {
                    mescon.last_message = ""
                    if ( msg_obj.ps_op === 'sub' ) {            // ps_op a pub/sub operation
                        let topic = msg_obj.topic
                        server.add_to_topic(topic,clientName,mescon)
                        let response_id = msg_obj._response_id
                        let response = { "_response_id" : response_id, "state" : "OK" }
                        mescon.sock.write(JSON.stringify(response))
                    } else if ( msg_obj.ps_op === 'pub' ) {     // ps_op a pub/sub operation
                        let topic = msg_obj.topic
                        let ignore = mescon.sock
                        server.send_to_all(topic,msg_obj,ignore)
                        let response_id = msg_obj._response_id
                        let response = { "_response_id" : response_id, "state" : "OK" }
                        mescon.sock.write(JSON.stringify(response))
                    } else {
                        let response_id = msg_obj._response_id
                        let response = this.app_message_handler(msg_obj)
                        response._response_id = response_id
                        mescon.sock.write(JSON.stringify(response))
                    }
                }
            });
            //
            sock.on('close', () => {
                let mescon = g_messenger_connections[clientName]
                mescon.sock.end()
                delete g_messenger_connections[clientName]
                this.remove_from_all_topics(clientName)
            });
            //
            sock.on('error', (err) => {
                console.error(`Connection ${clientName} error: ${err.message}`);
            });
            //
        }

        server.connection = net.createServer(onClientConnected_func);

        server.connection.listen(this.port, this.address, () => {
            console.log(`Server started at: ${this.address}:${this.port}`);
        });
        //
    }

    //
    app_message_handler(msg_obj) {
        console.log("Descendent must implement app_message_handler")
        return("OK")
    }

}
module.exports = Server;
