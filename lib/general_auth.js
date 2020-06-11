const uuid = require('uuid/v4')


// Top level of session managers, effectively supplying an interface for intialization
// Does some heavy lifting in controlling the flow of authorization and permission.
//




class SessionManager {
    //
    constructor(exp_app,db_obj,business) {  // reference to the DB and initializes the a middleware vector
        this.db = db_obj
        this.app = exp_app
        this.middle_ware = null
        let conf = exp_app._extract_conf()
        if ( conf ) {
            this.middle_ware = conf.middleware["session"]
        }
        if ( this.middle_ware === undefined ) {
            this.middle_ware = []
        }
        //
        this.business = business
        this.hashables = clonify(conf.forhash)
        //
        this.goingSessions = {};
        this.goingTokens = {};
        //
        this.user_cookie = conf.user_cookie
        this.max_age_user_cookie = 90000
    }


    addSession(key,token) {
        this.goingSessions[key] = token
        this.goingTokens[token] = key
        this.db.set_key_value(token,key)
    }


    destroyToken(token) {
        var key = this.goingTokens[token];
        if ( key != undefined ) {
            try {
                delete this.goingSessions[key]
                delete this.goingTokens[token]
                this.db.del_key_value(token)
            } catch (e) {
                //
            }
        }
    }
    
    // bool
    async tokenCurrent(token) {
        //
        if ( (this.goingTokens[token] == undefined) ) {
            //
            try {
                let key = await this.db.get_key_value(token)
                //
                if ( key == null ) {
                    return(false)
                } else {
                    this.goingSessions[key] = token;
                    this.goingTokens[token] = key;
                    return true
                }
            } catch(e) { // set an error flag
                return false
            }
            //
        }
        //
        return ( true )
    }

    //
    check(asset,req) {
        return(false)
    }


    storeCache(field_data,body) {
        var ehash = this.do_hash(field_data)
        this.db.set_key_value(ehash,JSON.stringify(body))
    }


    //
    process_user(user_op,body,req) {
        let transtion_object = {
            "token" : "nothing",
            "secondary_action" : false,
            "session_token" : undefined,
            "type" : "user"
        }

        switch ( user_op ) {
            case 'login' : {
                if ( (this.db.exists('user',post_body)) ) {
                    // start the session
                    post_body.logged_in = true
                    this.db.update('user',post_body)
                    transtion_object.secondary_action = true
                    transtion_object.token = 'user+' + uuid()
                    transtion_object.session_token = 'sess+' + uuid()
                    transtion_object.elements = { "match" :  this.do_hash(post_body[this.hashables.field1] + post_body[this.hashables.field2]) }
                }
                break;
            }
            case 'logout' : {
                if ( this.user_cookie ) {
                    var token = req.cookies[this.user_cookie]
                    if ( this.tokenCurrent(token) ) {
                        this.destroyToken(token)
                    }
                } else if ( (this.db.exists('user',post_body)) ) {
                    post_body.logged_in = false
                    this.db.update('user',post_body)
                }
                transtion_object.secondary_action = false
                transtion_object.session_token = 'sess+gone'
                break;
            }
            case 'register' : {
                if ( this.db ) {
                    if ( !(this.db.exists('user',post_body)) ) {
                        this.db.store_user(post_body)
                        this.business.process('new-user',post_body)
                        transtion_object.secondary_action = true
                        transtion_object.token = 'user+' + uuid()
                        transtion_object.session_token = 'sess+none'
                        transtion_object.elements = { "match" :  this.do_hash(post_body[this.hashables.field1] + post_body[this.hashables.field2]) }
                    }
                }        
                break;
            }
            case 'forgot' : {
                if ( this.db ) {
                    if ( (this.db.exists('user',post_body)) ) {
                        this.business.process('forgot',post_body)
                    }
                }        
                break;
            }
            default : {
                break;
            }
        }

        
        return(transtion_object)
    }

    //
    match(post_body,transtion_object)  {
        if ( post_body._t_match_field ) {
            let t_match = transtion_object.elements.match;
            if ( t_match === post_body._t_match_field ) {
                return true
            }
        }
        return false
    }


    //
    process_transition(transition,post_body,req) {  // req for any session cookies, etc.
        let suuid = '' + uuid()
        let transtion_object = {
            "token" : (post_body._uuid_prefix ? post_body._uuid_prefix : '') + suuid,
            "secondary_action" : true,
            "type" : "transition",
            "asset_key" : transition
        }
        return(transtion_object)
    }

    finalize_transition(transition,post_body,elements)  {
        return("OK")   // finalization state more likely some objecg
    }

    feasible(transition,post_body,req) {            // examine the session state to see if the transition can take place
        return(false)
    }


    //   assets
    process_asset(asset_id,post_body) {
        let transtion_object = {
            "token" : "nothing",
            "secondary_action" : false,
            "type" : "static_asset"
        }
        return(transtion_object)
    }


    update_session_state(transition,post_body,req) {    // req for session cookies if any
        return true
    }

    initialize_session_state(transition,session_token,transtionObj,res) {
        this.addSession(transtionObj._db_session_key,session_token)
        res.cookie(this.user_cookie,session_token, { maxAge: this.max_age_user_cookie, httpOnly: true });
    }


}



class GenearalAuth {

    constructor(sessClass) {
        this.db = null
        this.sessionClass = sessClass ? sessClass : SessionManager
    }

    sessions(exp_app,db_obj) {
        let sess_m = new this.sessionClass(exp_app,db_obj);
        this.db = db_obj
        return(sess_m)
    }

}



module.exports.GeneralAuth = GenearalAuth;
module.exports.SessionManager = SessionManager
