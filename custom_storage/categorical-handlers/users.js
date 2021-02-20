
const {ServeMessageEndpoint} = require("message-relay-services")
const fs = require('fs')
//
// and also a pub/sub client

const EMAIL_PATH = 'app-email'
const USER_PATH = 'user'
const CONTACT_PATH = 'contact'
const PERSITENCE_PATH = 'persistence'


let conf = {
    'port' : 5114,
    'address' : 'localhost'
}


let conf_path = process.argv[2]
if ( conf_path ) {
    conf = JSON.stringify(fs.readFileSync(conf_path,'ascii').toString())
}


// Parent class handles publication 

class UserMessageEndpoint extends ServeMessageEndpoint {

    constructor(conf) {
        super(conf)
        this.user_directory = conf.user_directory
    }

    app_message_handler(msg_obj) {
        let op = msg_obj.op
        switch ( op ) {
            case 'G' : {        // get user information
                break
            }
            case 'D' : {        // delete user from everywhere if all ref counts gones.
                break
            }
            default: {  // or send
                let action = msg_obj.user_op
                if ( action === "create" ) {
                    //
                    let user_path = this.user_directory + '/' + msg_obj[msg_obj.key_field]
                    fs.writeFile(user_path,JSON.stringify(msg_obj),(err) => {
                        if ( err ) {
                            console.log(">>-------------create------------------------")
                            console.log(err)
                            console.dir(msg_obj)
                            console.log("<<-------------------------------------")
                        }
                    })
                    //
                } else if ( action === "update" ) {
                    let user_path = this.user_directory + '/' + msg_obj[msg_obj.key_field] + ".json"
                    fs.readFile(user_path,{},(err,data) => {
                        if ( err ) {
                            console.log(">>-------------update read------------------------")
                            console.log(err)
                            console.dir(msg_obj)
                            console.log("<<-------------------------------------")
                        } else {
                            try {
                                let u_obj = JSON.parse(data.toString())
                                for ( let ky in msg_obj ) {
                                    u_obj[ky] = msg_obj[ky]
                                }
                                fs.writeFile(user_path,JSON.stringify(u_obj),(err) => {
                                    if ( err ) {
                                        console.log(">>-------------update write------------------------")
                                        console.log(err)
                                        console.dir(msg_obj)
                                        console.log("<<-------------------------------------")
                                    }
                                })
                            } catch (e) {
                                console.log(">>-------------update parse data------------------------")
                                console.log(e)
                                console.dir(msg_obj)
                                console.log("<<-------------------------------------")
                            }
                        }
                    })

                }
            }
        }
        //
        return({ "status" : "OK", "explain" : "op performed", "when" : Date.now() })
    }
}



let server = new UserMessageEndpoint(conf)
console.log(`${server.address}:${server.port}`)