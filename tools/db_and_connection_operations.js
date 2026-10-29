#!/usr/bin/env node
// 
const fs = require('fs')

const {MessageRelayer} = require('message-relay-services')


conf_file = process.argv[2]

if ( conf_file === undefined ) {
    console.log("the db tool needs a configuration file for sending connection commands to the transition app")
    process.exit(0)
}

let connection_type = process.argv[3]
if ( connection_type === undefined ) {
    console.log("the db tool needs a connection type for sending connection commands to the transition app")
    process.exit(0)
}

//
let conf_str = fs.readFileSync(conf_file).toString()
let conf = JSON.parse(conf_str)


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

let message_relayer = new MessageRelayer(conf)
message_relayer.on('client-ready',async () => {
    //
    //
    let descriptor = conf[connection_type]
    let msg_obj = {}

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    if ( descriptor.action = 'add-service' ) {
        msg_obj._tx_op = "AS"
        msg_obj._id = "add-connections"
    } else { // -- remove servivce
        msg_obj._tx_op = "RS"
        msg_obj._id = "remove-connections"
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    let cmd_pars = descriptor.parameters
    msg_obj.paramters = Object.assign({},cmd_pars);
    cmd_pars = msg_obj.paramters

    if ( typeof cmd_pars.conf !== 'object' ) {
        console.log("no configuration object specified for " + connection_type)
        process.exit(0)
    }

    if ( descriptor.action = "db-management" ) {
        if ( cmd_pars.target === "database" ) {
            //
            let possible_db_types = {
                "key_value_db" : false,
                "session_key_value_db" : false,
                "static_db" : true,
                "persistence_db" : true
            }
            let possible_ops = {
                "store" : true,
                "exists" : true,
                "query" : true,
                "drop" : true,
                "remove" : true
            }
            //
            if ( !(cmd_pars.db_type in possible_db_types) ) {
                console.log(`the database type ${cmd_pars.db_type} is not handled by copious transitions`)
                process.exit(0)
            }

            if ( possible_db_types[cmd_pars.db_type] ) {
                //
                if ( !(typeof cmd_pars.collection === 'string' ) ) {
                    console.log(`the database operations require a 'collection' parameter`)
                    process.exit(0)
                }
                //
                if ( !(cmd_pars.op in possible_ops) ) {
                    console.log(`The operation ${md_pars.op} is not a recognized database management operation`)
                    process.exit(0)
                }
                //
                if ( !(typeof cmd_pars.data === 'object') || !(typeof cmd_pars.query === 'object' || typeof cmd_pars.query === 'string') ) {
                    console.log(`The operation ${md_pars.op} requires some type of query 'data' or 'query`)
                    process.exit(0)
                }
                //
            }
        }
    } else if ( descriptor.action = 'add-service' ) {
        //
        if ( cmd_pars.target === 'transtion_engine' ) {
            //
            if ( typeof cmd_pars.module !== 'string' ) {
                console.log("no configuration object specified for " + connection_type)
                process.exit(0)
            }
            //
            const possible_transition_engine_fields = {
                "instance" : "string",
                "create" : "boolean"
            }
            //
            const module_may_have_methods = {
                "initialize" : "unary",
                "set_file_promise_ops" : "unary"
            }
            // // // // 
            //
        } else if ( cmd_pars.target === "database" ) {
            let possible_db_types = {
                "key_value_db" : true,
                "session_key_value_db" : true,
                "static_db" : true,
                "persistence_db" : true
            }
            if ( !(cmd_pars.db_type in possible_db_types) ) {
                console.log(`the database type ${cmd_pars.db_type} is not handled by copious transitions`)
                process.exit(0)
            }

            if ( !(cmd_pars.change) && !(cmd_pars.connect) ) {
                console.log(`the database changes require either change or connect fields to be true (not both)`)
                process.exit(0)
            }

            if ( typeof cmd_pars.module !== 'string' ) {
                console.log("no configuration object specified for database type " + cmd_pars.db_typ)
                process.exit(0)
            }

            const possible_database_fields = {
                "instance" : "string",
                "create" : "boolean"
            }
            //
        } else if ( cmd_pars.target === "websocket" ) {
            let possible_op_types = {
                "add_web_socket_server" : true,
                "new_http" : true,
                "new_websocket_class" : true
            }
            if ( !(cmd_pars.op in possible_op_types) ) {
                console.log(`the database type ${cmd_pars.db_type} is not handled by copious transitions`)
                process.exit(0)
            }

            switch ( cmd_pars.op ) {
                case "add_web_socket_server" : {
                    if ( typeof cmd_pars.port === "string" ) {
                        let port = parseInt(cmd_pars.port)
                        if ( `${port}` !== cmd_pars.port ) {
                            console.log(`the add_web_socket_server port number must be an integer`)
                            process.exit(0)            
                        }
                    }
                    break;
                }
                case "new_http" :
                case "new_websocket_class" : {
                    //
                    if ( typeof cmd_pars.module !== 'string' ) {
                        console.log("no configuration object specified for database type " + cmd_pars.db_typ)
                        process.exit(0)
                    }
                    //
                    const possible_database_fields = {
                        "instance" : "string",
                        "create" : "boolean"
                    }
                    break;
                }
            }
        }

    } else { // -- remove servivce
        //
        if ( cmd_pars.target === "database" ) {
            let possible_db_types = {
                "key_value_db" : true,
                "session_key_value_db" : true,
                "static_db" : true,
                "persistence_db" : true
            }
            if ( !(cmd_pars.db_type in possible_db_types) ) {
                console.log(`the database type ${cmd_pars.db_type} is not handled by copious transitions`)
                process.exit(0)
            }
        }
        //
    }

    // may have field instance

    let result = await message_relayer.send_on_path(msg_obj,"connections")
    console.dir(result)
    //
    message_relayer.closeAll()
    //
})
