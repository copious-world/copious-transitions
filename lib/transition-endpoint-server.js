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

class UserMessageEndpoint extends ServeMessageEndpoint {

    constructor(conf) {
        //
        super(conf)
        //
        this._transition_handler = false
        this._mime_handler = false
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    set_transition_handler(handler) {   // default set in general-transition-engine (must be in configuration -- transition-endpoint)
        if ( typeof handler === 'function' ) {
            this._transition_handler = handler
        }
    }

    set_mime_handler(handler) {
        if ( typeof handler === 'function' ) {
            this._mime_handler = handler
        }
    }

    //
    async app_message_handler(msg_obj) {
        let op = msg_obj._tx_op
        let result = "OK"
        let user_id = msg_obj._user_dir_key ? msg_obj[msg_obj._user_dir_key] : msg_obj._id
        if ( this.create_OK && !!(user_id) ) {
            await this.ensure_user_directories(user_id)
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
            default : {
                break
            }
        }
        //
        return({ "status" : result, "explain" : "op performed", "when" : Date.now(), "_tracking" : msg_obj._tracking })
    }


}


module.exports = UserMessageEndpoint
