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
        this.link_manager = false
        this.db = false
        this.transition_engine = false
        this.web_sockets = false
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

            case 'AS' : {   // admin method .... add a service
                if ( this.link_manager ) {
                    let cmd_pars = msg_obj.paramters
                    if ( cmd_pars ) {
                        await this.link_manager.add_service_connections(cmd_pars)
                    }    
                }
                break;
            }

            case 'RS' : {   // admin method .... remove a service
                if ( this.link_manager ) {
                    let cmd_pars = msg_obj.paramters
                    if ( cmd_pars ) {
                        await this.link_manager.remove_service_connections(cmd_pars)
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

    initialize_service_configuration(link_manager) {
        this.link_manager = link_manager
    }
}


module.exports = TransitionMessageEndpoint
