'use strict';

const fs = require('fs')
const {EventEmitter} = require('events')
 
const net = require('net');
const { type } = require('os');
const PORT = 1234;
const HOST = 'localhost';
const MAX_UNANSWERED_MESSAGES = 100
const DEFAULT_CONF_WRAP_LIMIT = 100
 
class Client extends EventEmitter {
    //
    constructor(conf) {
        super()
        this.port = conf ? conf.port || PORT : PORT
        this.address = conf ? conf.address || HOST : HOST
        this.max_unanswered =  conf ? conf.max_unanswered_messages || MAX_UNANSWERED_MESSAGES : MAX_UNANSWERED_MESSAGES  
        this.file_shunting = conf ? conf.file_shunting || false : false
        this.files_only = false
        this.file_per_message = false
        //
        this.socket = null
        this.files_going = false
        if ( conf ) this.init(conf);
    }

    //
    init(conf) {
        if ( conf === undefined ) {
            console.log("message relay client: cannot initialize -- no configuration")
            return;
        }
        //
        if ( conf.files_only ) {
            this.files_only = true
            this.file_shunting = true
            this.files_going = true
            this.setup_file_output(conf)
        } else {
            let client = this;
            //
            this.waiting_for_response = new Array(this.max_unanswered)
            this.waiting_for_response.fill(false,0,this.max_unanswered)
            //
            this.socket = new net.Socket();
            //
            client.socket.connect(client.port, client.address, () => {
                console.log(`Client connected to: ${client.address} :  ${client.port}`);
            });
            //
            client.socket.on('close', () => {
                console.log('Client closed');
            });
            //
            client.socket.on('data', (data) => {
                let str = data.toString()
                let message = undefined
                try {
                    message = JSON.parse(str)
                    if ( message._response_id !== undefined ) {
                        let resolver = this.waiting_for_response[message._response_id]
                        resolver(message)
                        return;
                    }
                } catch (e) {
                }
                this.handle_unsolicited(str,message)
            });
            //
            client.socket.on('error',(err) => {
                console.log(__filename)
                console.log(err);
                if ( this.file_shunting ) {
                    let output_dir = process.cwd()
                    if ( conf.output_dir !== undefined ) {
                        output_dir = conf.output_dir
                    }
                    let output_file = '/message_relay.txt'
                    if ( conf.output_file !== undefined ) {
                        output_file = conf.output_file
                    }
                    console.log(`falling back to ${output_dir + output_file}`)
                    let fpath = output_dir + output_file
                    this.file_output = fs.createWriteStream(fpath)
                    this.files_going = true
                }
            })
        }
        //
    }


    setup_file_output(conf) {
        let output_dir = process.cwd()
        if ( conf.output_dir !== undefined ) {
            output_dir = conf.output_dir
        }
        let output_file = '/message_relay.txt'
        if ( conf.output_file !== undefined ) {
            output_file = conf.output_file
        }
        console.log(`setting file output to ${output_dir + '/' + output_file}`)
        let fpath = output_dir + '/' + output_file
        //
        if ( conf.file_per_message  ) {
            this.file_per_message = conf.file_per_message
        }
        //
        if ( this.file_per_message ) {
            this.file_count = 0;  // count file in dir
            this.file_date = Date.now()
            this.file_output = fpath
        } else {
            this.message_count = 0
            this.message_wrap_limit = conf.wrap_limit ? conf.wrap_limit : DEFAULT_CONF_WRAP_LIMIT
            this.save_fpath = fpath
            this.file_output = fs.createWriteStream(fpath)
        }
        this.files_going = true
    }


    reset_file_stream() {
        this.message_count = 0
        this.file_output.close()
        let file_tag = Math.floor(Math.random()*100)
        fs.renameSync(this.save_fpath,this.save_fpath + '_' + Date.now() + '_' + file_tag)
        this.file_output = fs.createWriteStream(this.save_fpath)
    }

    //
    // get_response_id
    //      looks for a free position in the waiting_for_response array.
    //      Elements in use always contain resolver functions for relaying responses to waiting callers (await ...)
    //      usually found within 'async' functions.
    // 
    //
    get_response_id() {
        let first_try = Math.floor(Math.random()*this.max_unanswered)
        let try_index = first_try
        while ( try_index < this.max_unanswered ) {
            if ( this.waiting_for_response[try_index] === false ) {
                return(try_index)
            }
            try_index++
        }
        try_index = 0
        while ( try_index < first_try ) {
            if ( this.waiting_for_response[try_index] === false ) {
                return(try_index)
            }
            try_index++
        }
        return(-1) // server might be down
    }

    //
    handle_unsolicited(str,message) {
        if ( message === undefined ) {
            this.emit('update_string',str)
        } else {
            this.emit('update',message)
        }
    }

    send(message) {     // sometimes synonyms help
        this.sendMessage(message)
    }

    //
    // sendMessage
    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    //
    // This sends messages to IP endpoints. But, it may also write to a file if that has been setup through configuration 
    // with files_only. Another reason data may be place in files is that the socket may close or be broken in some way.
    //
    // If sending through on the sockets, this method will only ever add _response_id to the object being sent. 
    // This class expects the server to send _response_id back so that it can find callers without thunking too much. 
    // _response_id finds the requeting socket and relays the results back. 
    //
    // _response_id is specifically generated by get_response_id(). get_response_id returns an index for a space in 
    //  waiting_for_response array.
    //
    sendMessage(message) {   // secondary queuing is possible
        return new Promise((resolve, reject) => {
            if ( this.files_only ) {
                if ( this.files_going ) {
                    if ( this.file_output !== undefined ) {
                        let flat_message = JSON.stringify(message)
                        if ( this.file_per_message ) {
                            this.file_count++
                            let fname = (this.file_output + '_' + this.file_date + '_' + this.file_count)
                            fs.writeFile(fname,flat_message,(err) => {
                                if ( err ) {
                                    console.log(err)
                                }
                            })
                            resolve("OK")
                            return;
                        } else {
                            this.message_count++
                            if ( this.message_count >= this.message_wrap_limit ) {
                                this.reset_file_stream()
                            }
                            this.file_output.write(flat_message,'ascii')
                            resolve("OK")  // can't ask the file to deliver a response
                            return;
                        }
                    }            
                }
            } else {
                let client = this;
                //
                if ( this.files_going ) {       // default to this when connections fail..
                    if ( this.file_output !== undefined ) {
                        let flat_message = JSON.stringify(message)
                        this.file_output.write(flat_message,'ascii')
                        resolve("OK")  // can't ask the file to deliver a response
                        return;
                    }
                } else {
                    let id = this.get_response_id()
                    if ( id < 0 ) {
                        reject(new Error("send message max out... is server up?"))
                    }
                    message._response_id = id
                    //
                    let flat_message = JSON.stringify(message)
                    this.waiting_for_response[message._response_id] = (msg) => {
                        this.waiting_for_response[message._response_id] = false
                        resolve(msg)
                    }
                    client.socket.write(flat_message);
                    //
                    //
                    client.socket.on('error', (err) => {
                        reject(err);
                    });
                    //

                }
            }
        });
    }

    async publish(topic,message) {
        message.ps_op = "pub"
        message.topic = topic
        return await this.sendMessage(message)
    }

    async subscribe(topic,message,handler) {
        if ( handler !== undefined && (typeof handler === "function") ) {
            this.on('update',handler)
        }
        message.ps_op = "sub"
        message.topic = topic
        return await this.sendMessage(message)
    }

    async subscribe_strings(topic,message,handler) {
        if ( handler !== undefined && (typeof handler === "function") ) {
            this.on('update_string',handler)
        }
        message.ps_op = "sub"
        message.topic = topic
        return await this.sendMessage(message)
    }

    

    //
    async sendMail(mail) {
        try {
            let msg = {}
            for ( let ky in mail ) {
                msg[ky] = encodeURIComponent(mail[ky])
            }
            msg['m_path'] = 'app_email'
            let response = await this.sendMessage(msg)
            if ( response.trim() === "OK" ) {
                return(true)
            } else {
                return(false)
            }
        } catch (e) {
            console.error(e)
        }
    }

    closeAll() {
        let client = this;
        client.socket.destroy();
    }

}

//
module.exports = Client;
