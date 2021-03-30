const { GeneralAuth, SessionManager } = require.main.require('./lib/general_auth_session_lite')
//
const cookieParser = require('cookie-parser');

class UploaderSessionManager extends SessionManager {

    constructor(exp_app,db_obj,business,trans_engine) {
        super(exp_app,db_obj,business,trans_engine)
        //
        this.middle_ware.push(cookieParser())           // use a cookie parser
     }

    //process_asset(asset_id,post_body) {}

    which_uploaded_files(req,post_body) {
        if ( typeof this.trans_engine.which_uploaded_files === "function" ) {
            return(this.trans_engine.which_uploaded_files(req,post_body))
        } else {
            return(req.files)      // the application should handle this
        } //let sampleFile = req.files.mp3file;
    }

    feasible(transition,post_body,req) {
        if (  G_demo_submit_trns.tagged(transition) ) {
            return(true)
        }
        if (  G_publication_submit_trns.tagged(transition) ) {
            return(true)
        }
        if ( G_configurable_submit_trns.tagged(transition) ) {
            return(true)
        }
        return(super.feasible(transition,post_body,req))
    }

    //
    async process_transition(transition,post_body,req) {
        let trans_object = super.process_transition(transition,post_body,req)
        //
        if ( G_uploader_trns.tagged(transition) ) {
            trans_object.secondary_action = false
        }
        if ( G_demo_submit_trns.tagged(transition) ) {
            trans_object.secondary_action = false
            post_body.file_type = G_demo_submit_trns.file_type()
        }
        if ( G_configurable_submit_trns.tagged(transition) ) {
            post_body.file_type = G_configurable_submit_trns.file_type()
            G_configurable_submit_trns.prep(post_body)
            let files = this.which_uploaded_files(req,post_body)
            let state = await this.trans_engine.upload_file(post_body,G_configurable_submit_trns,files)
            if ( state.OK == false ) return false
            trans_object.elements = {
                "protocol" : "ipfs",
                "media_id" : state.ids[0]
            }
        }
        //
        return(trans_object)
    }

    //
    //
    finalize_transition(transition,post_body,elements,req) {
        
        if ( G_configurable_submit_trns.tagged(transition) ) {
            if ( G_configurable_submit_trns.business ) {
                this.business.process('dashboard-options',post_body)
            }
            return(state)
        } else {
            let files = this.which_uploaded_files(req,post_body)
            if ( G_uploader_trns.tagged(transition) ) {
                return(this.trans_engine.upload_file(post_body,G_uploader_trns,files))
            }
            if ( G_demo_submit_trns.tagged(transition) ) {
                let state = this.trans_engine.upload_file(post_body,G_demo_submit_trns,files)
                if ( this.business ) {
                    this.business.process('demo',post_body)
                }
                return(state)
            }
            if ( G_publication_submit_trns.tagged(transition) ) {
                let state = this.trans_engine.upload_file(post_body,G_publication_submit_trns,files)
                if ( this.business ) {
                    this.business.process('submitter',post_body)
                }
                return(state)
            }    
        }

        let finalization_state = {
            "state" : "ERROR",
            "OK" : "false"
        }
        return(finalization_state)
    }


    passing(asset) {
        if ( G_uploader_trns.static_entries ) {
            return( G_uploader_trns.static_entries.indexOf(asset) >= 0 )
        }
        return true
    }

    async guard(asset,body,req) {
        if ( this.passing(asset) ) {
            let token = body.token      // in this app the token will not be provided
            if ( token ) {
                let active = await this.tokenCurrent(token)
                return active
            }
        }
        return(true)    // true by default
    }

    
}

class UploaderAuth  extends GeneralAuth {
    constructor() {
        super(UploaderSessionManager)   // intializes general authorization with the customized session manager class.
    }
}

var session_checker = new UploaderAuth()
module.exports = session_checker;