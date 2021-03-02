const uuid = require('uuid/v4')
const AppLifeCycle = require("./general_lifecyle")


class SessionManager_Lite extends AppLifeCycle {
    constructor(exp_app,db_obj,business,transition_engine) {  // reference to the DB and initializes the a middleware vector
        super()
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
        this.conf = conf
        //
        this.business = business
        this.trans_engine = transition_engine
        //
        this.hashables = clonify(conf.forhash)
        //
        this.user_cookie = conf.user_cookie
        this.max_age_user_cookie = 90000
        this.goingSessions = {};
        this.goingTokens = {};
    }

    extract_exposable_user_info(user,info) {
        return(user.name)
    }


    async current_active(token,accessor,src_key) {
        let key = this.goingTokens[token]
        if ( (key !== undefined) ) {
            return key
        } else {
            try {
                key = await accessor(token,src_key)
                if ( key == null ) {
                    return (false)
                } else {
                    this.goingTokens[token] = key;
                    return (key)
                }
            } catch (e) {
                return (false)
            }
        }
    }
 
    // bool
    async tokenCurrent(token) {
        let accessor = async (token,src_key) => { return await this.db.get_key_value(token,src_key) }
        return (this.current_active(token,accessor,undefined) !== false)
    }

    async sessionCurrent(token,src_key) {
        if ( src_key === undefined ) return(false)
        let accessor = async (token,src_key) => { return await this.db.get_session_key_value(token,src_key) }
        let key = await this.current_active(token,accessor,src_key)
        if ( key !== false ) {
            this.goingSessions[key] = token;
        }
        return key
    }

    //
    async guard(asset,body,req) {
        return(true)    // true by default
    }

    post_body_decode(udata) {
        for ( let key in udata ) {
            let field = udata[key]
            if ( field ) {
                field = decodeURIComponent(field)
                udata[key] = field.trim()
            }
        }
        return(udata)
    }

    // default behavior -- 
    do_hash(str) {
        return(global_hasher(str))
    }

    sess_data_accessor() {
        return "app_user_data"
    }
 
    unstash_session_token(transObject) {
        let key = this.sess_data_accessor()
        return(transObject.elements[key])
    }

    key_for_user() {    // override this for tracking the user across of few user transitions
        return('id')
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

    finalize_transition(transition,post_body,elements,req)  {
        let finalization_state = {
            "state" : "UP",
            "OK" : "true"
        }    
        return(finalization_state)   // finalization state more likely some objecg
    }

    feasible(transition,post_body,req) {            // examine the session state to see if the transition can take place
        return(false)
    }

    // --
    session_accrue_errors(category,data,err) {}

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


    set_cookie(res,cookie_id,value,age) {
        // application overried 
    }

    release_cookie(res,cookie_id) {}


    app_user_check_cookie(req,session_token) {/* application only */}

}



class GeneralAuth extends AppLifeCycle {

    constructor(sessClass) {
        super()
        //
        this.db = null
        this.trans_engine = null
        this.sessionClass = sessClass ? sessClass : SessionManager
    }

    sessions(exp_app,db_obj,bussiness,transition_engine) {
        let sess_m = new this.sessionClass(exp_app,db_obj,bussiness,transition_engine);
        this.db = db_obj
        return(sess_m)
    }

}

module.exports.GeneralAuth = GeneralAuth;
module.exports.SessionManager_Lite = SessionManager_Lite
module.exports.SessionManager = SessionManager_Lite
