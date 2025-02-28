//
const {MultiPathRelayClient} = require("message-relay-services")
const GeneralAppLifeCycle = require('./general_lifecyle')
//

/** 
 * This class provides a interface to transition processing for requests (JSON)
 * being delivered by backend services implemented as applications of the 
 * message-relay-services module.
 * 
 * @memberof base
 */

class LinkManager extends GeneralAppLifeCycle {

    constructor(conf) {
        //
        super(conf)
        //
        this._transition_handler = false
        this._mime_handler = false
        //
        this.link_manager = false
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
        this.multi_path = false
        //
        this.link_path_seeker_map = {}
    }


    initialize(conf,db,transition_engine,web_sockets,sessions,statics,dynamics,business,validator) {
        //
        if ( conf.link_manager_paths ) {
            this.multi_path = new MultiPathRelayClient(conf.link_manager_paths)
        }
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
                let initialized_db = true
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
                                await this.db.change_static_db_instance(new_db,conf)
                            }
                        } else if ( cmd_pars.connect === true ) {  // original instance may be a multipath
                            await this.db.add_static_db_connection(conf)
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


}


module.exports = LinkManager
