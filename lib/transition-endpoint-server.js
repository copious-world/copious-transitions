//
const {ServeMessageEndpoint} = require("message-relay-services")
//

/** 
 * This class provides a interface to transition processing for requests (JSON)
 * being delivered by backend services implemented as applications of the 
 * message-relay-services module.
 * 
 * @memberof base
 */

class TransitionMessageEndpoint extends ServeMessageEndpoint {

    constructor(conf) {
        //
        super(conf)
        //
        this._transition_handler = false
        this._mime_handler = false
        //
        this.db = false
        this.transition_engine = false
        this.web_sockets = false

    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    /**
     * This method gives the caller the opportunity to set the handler for handling 
     * transtions (similar to POST methods)
     * 
     * @param {Function} handler 
     */
    set_transition_handler(handler) {   // default set in general-transition-engine (must be in configuration -- transition-endpoint)
        if ( typeof handler === 'function' ) {
            this._transition_handler = handler
        }
    }

    /**
     * This method gives the caller the opportunity to set the handler for handling 
     * mime data requests. (similar to GET methods)
     * 
     * @param {Function} handler 
     */
    set_mime_handler(handler) {
        if ( typeof handler === 'function' ) {
            this._mime_handler = handler
        }
    }

    //
    /**
     * This method is the override of the `app_message_handler` defined in the super class ServeMessageEndpoint.
     * 
     * This message handler implements the responses to `_tx_op`s 'G' (get) and 'S' (set).
     * A 'G' message that is properly setup will result in a call to the mime handler that had to be set by the application.
     * A 'S' message that is properly setup will result in a call to the transtion handler that had to be set by the application.
     * 
     * In most cases, it can be expected that the methods found in contractuals will be the handlers that are set to the 
     * parameters of this class. 
     * 
     * @param {object} msg_obj 
     * @returns {object}
     */
    async app_message_handler(msg_obj) {
        let op = msg_obj._tx_op
        let result = "OK"
        let user_id = msg_obj._user_dir_key ? msg_obj[msg_obj._user_dir_key] : msg_obj._id
        if ( this.create_OK && !!(user_id) ) {
            await this.ensure_user_directories(user_id)  // is this needed here?
        }
        msg_obj._id = user_id
        //
        switch ( op ) {
            case 'G' : {        // get user information
                let stat = "ERR"
                if ( this._mime_handler ) {
                    let asset = msg_obj.asset
                    let [mime,value] = this._mime_handler(asset,msg_obj)
                    return({ "status" : "OK", "data" : value, "mime" : mime, "explain" : "get", "when" : Date.now() })
                }
                return({ "status" : stat, "data" : false,  "explain" : "get", "when" : Date.now() })
            }
            case 'D' : {        // delete user from everywhere if all ref counts gones.
                                // don't do this here...
                break
            }
            case 'S' : {  // or send
                if ( this._transition_handler ) {
                    let transition = msg_obj.transition
                    return this._transition_handler(transition,msg_obj)
                }
                break
            }

            
            case 'AKP' : {   // admin method .... add a service
                let cmd_pars = msg_obj.paramters
                if ( cmd_pars ) {
                    let conf = cmd_pars.conf
                    switch ( cmd_pars.target ) {
                        case 'transtion_engine' : {
                            if ( !(this.transition_engine) ) {
                                break;
                            }
                            try {
                                let fs_promises = require(cmd_pars.module)
                                if ( typeof cmd_pars.instance === 'string' ) {
                                    fs_promises = fs_promises[cmd_pars.instance]
                                }
                                if ( cmd_pars.create === true ) {
                                    if ( fs_promises ) {
                                        fs_promises = new fs_promises(conf)
                                    }
                                } else if ( conf ) {
                                    fs_promises.initialize(conf)
                                }
                                if ( fs_promises ) {
                                    this.transition_engine.set_file_promise_ops(fs_promises)
                                }    
                            } catch (e) {}
                            break;
                        }
                        case "database" : {
                            if ( !(this.db) ) {
                                break;
                            }
                            //
                            let new_db = false
                            if ( cmd_pars.change === true ) {
                                try {
                                    new_db = require(cmd_pars.module)
                                    if ( typeof cmd_pars.instance === 'string' ) {
                                        new_db = new_db[cmd_pars.instance]
                                    }
                                    if ( cmd_pars.create === true ) {
                                        if ( new_db ) {
                                            new_db = new new_db(conf)
                                        }
                                    } else if ( conf ) {
                                        new_db.initialize(conf)
                                    }
                                } catch (e) {}    
                            }
                            //
                            switch ( cmd_pars.db_type ) {
                                case "key_value_db" : {
                                    if ( cmd_pars.change === true ) {
                                        await this.db.change_key_value_db_instance(new_db,conf)
                                    } else if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                                        await this.db.add_key_value_db_connection(conf)
                                    }    
                                    break;
                                }
                                case "session_key_value_db" : {
                                    if ( cmd_pars.change === true ) {
                                        await this.db.change_static_db_instance(new_db,conf)
                                    } else if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                                        await this.db.add_static_db_connection(conf)
                                    }    
                                    break;
                                }
                                case "static_db" : {
                                    if ( cmd_pars.change === true ) {
                                        await this.db.change_static_key_value_db_instance(new_db,conf)
                                    } else if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                                        await this.db.add_static_key_value_db_connection(conf)
                                    }    
                                    break;
                                }
                                case "persistence_db" : {
                                    if ( cmd_pars.change === true ) {
                                        await this.db.change_persistence_db_instance(new_db,conf)
                                    } else if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                                        await this.db.add_persistence_db_connection(conf)
                                    }    
                                    break;
                                }
                            }
                            break;
                        }
                        case "websocket" : {
                            if ( !(this.web_sockets) ) {
                                break;
                            }
                            switch ( cmd_pars.op ) {
                                case "add_web_socket_server" : {
                                    if ( cmd_pars.port ) {
                                        this.web_sockets.add_service(cmd_pars.port)
                                    }
                                    break;
                                }
                                case "new_http" : {
                                    let new_http = false
                                    try {
                                        new_http = require(cmd_pars.module)
                                        if ( typeof cmd_pars.instance === 'string' ) {
                                            new_http = new_http[cmd_pars.instance]
                                        }
                                        if ( cmd_pars.create === true ) {
                                            if ( new_db ) {
                                                new_http = new new_http(conf)
                                            }
                                        } else if ( conf ) {
                                            new_http.initialize(conf)
                                        }
                                    } catch (e) {}
                                    //
                                    await this.web_sockets.change_http_service_creator(new_http)
                                    break;
                                }

                                case "new_websocket_class" : {
                                    let new_ws_class = false
                                    try {
                                        new_ws_class = require(cmd_pars.module)
                                        if ( typeof cmd_pars.instance === 'string' ) {
                                            new_ws_class = new_ws_class[cmd_pars.instance]
                                        }
                                        if ( cmd_pars.create === true ) {
                                            if ( new_db ) {
                                                new_ws_class = new new_ws_class(conf)
                                            }
                                        } else if ( conf ) {
                                            new_ws_class.initialize(conf)
                                        }
                                    } catch (e) {}
                                    await this.web_sockets.change_websocket_server_class(new_ws_class)
                                    break;
                                }
                            }

                            break;
                        }
                    }
                }
                break;
            }

            case 'RKP' : {   // admin method .... remove a service
                let cmd_pars = msg_obj.paramters
                if ( cmd_pars ) {
                    switch ( cmd_pars.target ) {
                        case "database" : {
                            switch ( cmd_pars.db_type ) {
                                case "key_value_db" : {
                                    await this.db.remove_key_value_db_connection(conf)
                                    break;
                                }
                                case "session_key_value_db" : {
                                    await this.db.remove_session_key_value_db_connection(conf) 
                                    break;
                                }
                                case "static_db" : {
                                    await this.db.remove_static_db_connection(conf)
                                    break;
                                }
                                case "persistence_db" : {
                                    await this.db.remove_persistence_db_connection(conf)
                                    break;
                                }
                            }
                            break
                        }
                    }
                }
                break;
            }


            default : {
                break
            }
        }
        //
        return({ "status" : result, "explain" : "op performed", "when" : Date.now(), "_tracking" : msg_obj._tracking })
    }


    initialize_service_configuration(db,transition_engine,web_sockets) {
        this.db = db
        this.transition_engine = transition_engine
        this.web_sockets = web_sockets
    }
}


module.exports = TransitionMessageEndpoint
