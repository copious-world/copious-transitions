//
const {ServeMessageEndpoint} = require("message-relay-services")
//

// Parent class handles publication 

class UserMessageEndpoint extends ServeMessageEndpoint {

    constructor(conf) {
        //
        super(conf)
        //
        this._transition_handler = false
    }


    set_transition_handler(handler) {
        if ( typeof handler === 'function' ) {
            this._transition_handler = handler
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
                let stat = "OK"
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
