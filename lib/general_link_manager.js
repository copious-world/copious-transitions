//
const GeneralAppLifeCycle = require('./general_lifecyle')
const LinkManager = require("com_link_manager")
//


/** 
 * This class provides a interface to transition processing for requests (JSON)
 * being delivered by backend services implemented as applications of the 
 * message-relay-services module.
 * 
 * @memberof base
 */

Object.assign(LinkManager.prototype,GeneralAppLifeCycle.prototype)

class CTLinkManager extends LinkManager {

    constructor() {
        super()
        //
        this.db = false
        this.transition_engine = false
        this.web_sockets = false
        //
        this.session_manager = false
        this.statics = false
        this.dynamics = false 
        this.business = false
        this.validator = false
        //
        this.link_path_seeker_map = {}
    }


    initialize(conf,db,transition_engine,web_sockets,sessions,statics,dynamics,business,validator) {
        //
        this.conf = conf
        // for now, treating these as special cases
        this.db = db
        this.transition_engine = transition_engine
        this.web_sockets = web_sockets
        //
        this.session_manager = sessions
        this.statics = statics
        this.dynamics = dynamics 
        this.business = business
        this.validator = validator
        //
        this.add_paths_for(this.session_manager)
        this.add_paths_for(this.statics)
        this.add_paths_for(this.dynamics)
        this.add_paths_for(this.business)
        this.add_paths_for(this.validator)
        //
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



    /**
     * add_paths_for
     * 
     * 
     * Allows for a com class user to limit the paths that outside tools can request.
     * The tools are supposed to be used in secure admin contexts. 
     * Yet, there can be error and overreach.
     * 
     * This method is provided for the cases in which the target cannot be identified. 
     * Yet, some class can still be querried for adding in communication components.
     * 
     * @param {object} instance 
     */
    add_paths_for(instance) {
        if ( instance ) {
            let paths = instance.seeking_endpoint_paths()
            if ( paths && Array.isArray(paths) ) {
                for ( let path of paths ) {
                    let seeker_list = this.link_path_seeker_map[path]
                    if ( seeker_list === undefined ) {
                        seeker_list = []
                        this.link_path_seeker_map[path] = seeker_list
                    }
                    seeker_list.push(instance)
                }
            }
        }
    }

    // ---- ---- ---- ---- ---- ---- ----

    /**
     * add_service_connections
     * 
     * @param {Object} cmd_pars -- connection command processing directive
     */

    async add_service_connections(cmd_pars) {
        let conf = cmd_pars.conf
        switch ( cmd_pars.target ) {
            case 'transtion_engine' : {
                if ( !(this.transition_engine) ) {
                    break;
                }
                let fs_promises = false
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
                        await fs_promises.initialize(conf)
                    }
                    if ( fs_promises ) {
                    }
                } catch (e) {}
                //
                switch ( cmd_pars.link_type ) {
                    case "file" : {
                        if ( fs_promises ) {
                            this.transition_engine.set_file_promise_ops(fs_promises)
                        }
                        break;
                    }
                    case "repo" : {
                        if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                            await this.transition_engine.add_repo_path(conf)
                        }  
                        break
                    }
                }
                break;
            }
            case "database" : {
                if ( !(this.db) ) {
                    break;
                }
                //
                let new_db = false
                let initialized_db = true
                if ( cmd_pars.change === true ) {
                    try {
                        new_db = require(cmd_pars.module)
                        if ( typeof cmd_pars.instance === 'string' ) {  // if a particular class is taken out of the module
                            new_db = new_db[cmd_pars.instance]
                        }
                        if ( cmd_pars.create === true ) {
                            if ( new_db ) {
                                new_db = new new_db(conf)
                            }
                        }
                        if ( conf && conf.initialize ) {
                            if ( typeof new_db.initialize  === 'function' ) {
                                initialized_db = await new_db.initialize(conf)
                            }
                        }
                    } catch (e) {}    
                }
                //
                //
                switch ( cmd_pars.db_type ) {
                    case "key_value_db" : {
                        if ( cmd_pars.change === true ) {
                            if ( initialized_db !== false ) {
                                await this.db.change_key_value_db_instance(new_db,conf)
                            }
                        } else if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                            await this.db.add_key_value_db_connection(conf)
                        }    
                        break;
                    }
                    case "session_key_value_db" : {
                        if ( cmd_pars.change === true ) {
                            if ( initialized_db !== false ) {
                                await this.db.change_session_key_value_db_instance(new_db,conf)
                            }
                        } else if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                            await this.db.add_session_key_value_db_connection(conf)
                        }    
                        break;
                    }
                    case "static_db" : {
                        if ( cmd_pars.change === true ) {
                            if ( initialized_db !== false ) {
                                await this.db.change_static_key_value_db_instance(new_db,conf)
                            }
                        } else if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                            await this.db.add_static_key_value_db_connection(conf)
                        }    
                        break;
                    }
                    case "persistence_db" : {
                        if ( cmd_pars.change === true ) {
                            if ( initialized_db !== false ) {
                                await this.db.change_persistence_db_instance(new_db,conf)
                            }
                        } else if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                            await this.db.add_persistence_db_connection(conf)
                        }    
                        break;
                    }
                    case "admin_relays" : {
                        await this.db.establish_admin_endpoints(conf)
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
                    //
                    case "add_web_socket_server" : {
                        if ( cmd_pars.port ) {
                            this.web_sockets.add_service(cmd_pars.port)
                        }
                        break;
                    }
                    //
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
                    //
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
            default : {
                try {
                    let path = cmd_pars.path
                    let seeker_list = this.link_path_seeker_map[path]
                    if ( seeker_list && seeker_list.length ) {
                        //
                        let new_con = false
                        try {
                            new_con = require(cmd_pars.module)
                            if ( typeof cmd_pars.instance === 'string' ) {
                                new_con = new_con[cmd_pars.instance]
                            }
                            if ( cmd_pars.create === true ) {
                                if ( new_db ) {
                                    new_con = new new_con(conf)
                                }
                            } else if ( conf ) {
                                await new_con.initialize(conf)
                            }
                        } catch (e) {}
                        //
                        for ( let seeker of seeker_list ) {
                            seeker.set_messenger(path,new_con)
                        }
                        // 
                    }
                } catch (e) {}
                break;

                //set_messenger
            }
        }
    }


    async remove_service_connections(cmd_pars) {
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
    }




    check_admin_ok(admin_capable) {
        return true
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

            default : {
                if ( msg_obj._x_admin_capable && this.check_admin_ok(msg_obj._x_admin_capable) ) {
                    return await super.app_message_handler(msg_obj)
                }
            }
        }
        //
        return({ "status" : result, "explain" : "op performed", "when" : Date.now(), "_tracking" : msg_obj._tracking })
    }



}


module.exports = CTLinkManager
