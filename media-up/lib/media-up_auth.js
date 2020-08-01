const { GeneralAuth, SessionManager } = require.main.require('./lib/general_auth_session_lite')
//
const cookieParser = require('cookie-parser');

class UploaderSessionManager extends SessionManager {

    constructor(exp_app,db_obj,business) {
        super(exp_app,db_obj,business)
        //
        this.middle_ware.push(cookieParser())           // use a cookie parser
     }

    //process_asset(asset_id,post_body) {}

    which_uploaded_files(req,post_body) {
        //let sampleFile = req.files.mp3file;
        return(req.files)      // the application should handle this
    }


    feasible(transition,post_body,req) {
        if (  G_singer_submit_trns.tagged(transition) ) {
            return(true)
        }
        if (  G_song_submit_trns.tagged(transition) ) {
            return(true)
        }
        return(super.feasible(transition,post_body,req))
    }

    //
    process_transition(transition,post_body,req) {
        let trans_object = super.process_transition(transition,post_body,req)
        //
        if ( G_uploader_trns.tagged(transition) ) {
            trans_object.secondary_action = false
        }
        if ( G_singer_submit_trns.tagged(transition) ) {
            trans_object.secondary_action = false
            post_body.file_type = "mp3"
        }
        if ( G_song_submit_trns.tagged(transition) ) {
            trans_object.secondary_action = false
            post_body.file_type = "mp3"
        }
        //
        return(trans_object)
    }

    //
    //
    finalize_transition(transition,post_body,elements,req) {
        if ( G_uploader_trns.tagged(transition) ) {
            return(this.upload_file(post_body,G_uploader_trns,req))
        }
        if ( G_singer_submit_trns.tagged(transition) ) {
            let state = this.upload_file(post_body,G_singer_submit_trns,req)
            if ( this.business ) {
                this.business.process('voice-demo',post_body)
            }
            return(state)
        }
        if ( G_song_submit_trns.tagged(transition) ) {
            let state = this.upload_file(post_body,G_song_submit_trns,req)
            if ( this.business ) {
                this.business.process('submitter',post_body)
            }
            return(state)
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