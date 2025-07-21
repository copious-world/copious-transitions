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

    constructor(conf) {
        super(conf)
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
        this.class_conf = conf.link_manager
        let lconf = this.class_conf
        //
        if ( lconf && lconf.link_manager_paths ) {
            this.multi_path = new MultiPathRelayClient(lconf.link_manager_paths)
        }
        // for now, treating these as special cases
        this.db = db
        this.transition_engine = transition_engine
        this.web_sockets = web_sockets
        //
        this.transition_engine.link_manager = this
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
        this.add_paths_for(this.db.pdb)
        this.add_paths_for(this.db.sdb)
        this.add_paths_for(this.db.key_value_db)
        this.add_paths_for(this.db.session_key_value_db)
        ///
        
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


    // ---- ---- ---- ---- ---- ---- ----


    /**
     * add_service_connections
     * 
     * Calls the super's method first. If the super cannot handle the configuration, then this method takes into consideration
     * the special cases for this custom class.
     * 
     * 
     * @param {Object} cmd_pars -- connection command processing directive
     */

    async add_service_connections(cmd_pars) {

        let maybe_instance = await super.add_service_connections(cmd_pars)

        if ( typeof maybe_instance === 'boolean' ) {
            return maybe_instance
        } else {
            let conf = cmd_pars.conf
            switch ( cmd_pars.target ) {
                case 'transtion_engine' : {
                    if ( !(this.transition_engine) ) {
                        break;
                    }
                    let fs_promises = maybe_instance
                    switch ( cmd_pars.link_type ) {
                        case "file" : {
                            this.transition_engine.set_file_promise_ops(fs_promises)
                            break;
                        }
                        case "repo" : {
                            if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                                await this.transition_engine.add_repo_path(maybe_instance)
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
                    let initialized_db = maybe_instance
                    //
                    let conf_list = conf
                    if ( !(Array.isArray(conf_list)) ) {
                        conf_list = [conf_list]
                    }
                    for ( let cnf of conf_list ) {
                        switch ( cmd_pars.db_type ) {
                            case "key_value_db" : {
                                if ( cmd_pars.change === true ) {
                                    await this.db.change_key_value_db_instance(initialized_db,cnf)
                                }   
                                break;
                            }
                            case "session_key_value_db" : {
                                if ( cmd_pars.change === true ) {
                                    await this.db.change_session_key_value_db_instance(initialized_db,cnf)
                                }   
                                break;
                            }
                            case "static_db" : {
                                if ( cmd_pars.change === true ) {
                                    await this.db.change_static_key_value_db_instance(initialized_db,cnf)
                                }  
                                break;
                            }
                            case "persistence_db" : {
                                if ( cmd_pars.change === true ) {
                                    await this.db.change_persistence_db_instance(initialized_db,cnf)
                                }   
                                break;
                            }
                            case "admin_relays" : {
                                await this.db.establish_admin_endpoints(maybe_instance,cnf)
                                break;
                            }
                        }
                    }
                    //    
                    break;
                }
                case "websocket" : {
                    if ( !(this.web_sockets) ) {
                        break;
                    }
                    switch ( cmd_pars.op ) {
                        case "add_web_socket_server" : {
                            if ( cmd_pars.port ) {
                                let ws = maybe_instance  // if we got to here, the port has already been opened
                                this.web_sockets.add_service_instance(ws,cmd_pars.port_name)
                            }
                            break;
                        }
                        //
                        case "new_http" : {
                            let new_http = maybe_instance
                            await this.web_sockets.change_http_service_creator(new_http)
                            break;
                        }
                    }
    
                    break;
                }
            }
        }

        return true
    }


    /**
     * update_service_connections
     * @param {object} cmd_pars 
     * @returns 
     */
    async update_service_connections(cmd_pars) {

        let maybe_instance = await super.update_service_connections(cmd_pars)

        if ( typeof maybe_instance === 'boolean' ) {
            return maybe_instance
        } else {
            let conf = cmd_pars.conf
            switch ( cmd_pars.target ) {
                case 'transtion_engine' : {
                    if ( !(this.transition_engine) ) {
                        break;
                    }
                    switch ( cmd_pars.link_type ) {
                        case "repo" : {
                            if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                                await this.transition_engine.add_repo_path(maybe_instance)
                            }  
                            break
                        }
                    }
                    break;
                }
                case "database" : {
                    //
                    if ( !(this.db) ) {
                        break;
                    }
                    //
                    let conf_list = conf
                    if ( !(Array.isArray(conf_list)) ) {
                        conf_list = [conf_list]
                    }
                    for ( let cnf of conf_list ) {
                        //
                        switch ( cmd_pars.db_type ) {
                            case "key_value_db" : {
                                if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                                    await this.db.add_key_value_db_connection(cnf)
                                }    
                                break;
                            }
                            case "session_key_value_db" : {
                                if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                                    await this.db.add_session_key_value_db_connection(cnf)
                                }    
                                break;
                            }
                            case "static_db" : {
                                if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                                    await this.db.add_static_key_value_db_connection(cnf)
                                }    
                                break;
                            }
                            case "persistence_db" : {
                                if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                                    await this.db.add_persistence_db_connection(cnf)
                                }    
                                break;
                            }
                        }
                        //
                    }

    
                    break;
                }
                case "websocket" : {
                    if ( !(this.web_sockets) ) {
                        break;
                    }
                    switch ( cmd_pars.op ) {
                        case "new_websocket_class" : {
                            let ws_class = instance
                            await this.web_sockets.change_websocket_server_class(ws_class)
                            break;
                        }
                    }
    
                    break;
                }
            }
        }

    }


    /**
     * remove_service_connections
     * 
     * @param {object} cmd_pars 
     * @returns 
     */
    async remove_service_connections(cmd_pars) {
        //
        let maybe_instance = await super.remove_service_connections(cmd_pars)
        //
        if ( typeof maybe_instance === 'boolean' ) {
            return maybe_instance
        } else {
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
        //
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
        switch ( op ) {     // on this level, expose contractual operations ... the parent is an actual link manager
            
            case 'G' : {        // work the endpoint pathway.
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
                    return await super.app_message_handler(msg_obj) // access to link_manager cases (sAS, US, RS, RN)
                }
            }
        }
        //
        return({ "status" : result, "explain" : "op performed", "when" : Date.now(), "_tracking" : msg_obj._tracking })
    }



}


module.exports = CTLinkManager
