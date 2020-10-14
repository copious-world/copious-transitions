const { GeneralAuth, SessionManager } = require.main.require('./lib/general_auth_session_lite')
//
const cookieParser = require('cookie-parser');

const CONST_PROGRAMMED_ASSET_WAVE_KEYS = 7  // just some number a low prime seemed to be a good place to start
const GET_PUBLIC_KEY_FOR_KEY_WRAPPING_IN_CLIENT = 'identified_key_wrapper_pub_key'
const GET_PUBLIC_KEY_FOR_RESTORE_KEY_WRAPPING_IN_CLIENT = 'restore_key_wrapper_pub_key'
const CHUNK_POST_COM_WSSURL_REQ = 'hash_progress_com_wss_url' 


class SearcherSessionManager extends SessionManager {

    constructor(exp_app,db_obj,business,trans_engine) {
        //
        super(exp_app,db_obj,business,trans_engine)
        //
        this.middle_ware.push(cookieParser())           // use a cookie parser
    }

    async feasible(transition,post_body,req) {                // is the transition something that can be done?
        if (  G_spotify_searcher_trns.tagged(transition) ) {
            return(true)
        }
        if (  G_wave_store_trns.tagged(transition) ) {
            return(true)
        }
        if (  G_wave_mover_trns.tagged(transition) ) {
            let found_session = await this.db.cache_if_found(post_body.sess_id, { 'audiorecowner' : post_body.email })
            return(found_session)
        }
        if ( G_wss_chunk.tagged(transition) || G_wss_chunk_final.tagged(transition) || G_wss_chunk_change.tagged(transition) ) {
            let fields_present = (post_body.email !== undefined )
            fields_present = fields_present && (post_body.session !== undefined )
            fields_present = fields_present && (post_body.client_time !== undefined )
            fields_present = fields_present && (post_body.server_id !== undefined )
            return(fields_present)
        }

        return(super.feasible(transition,post_body,req))
    }


    // restore_wrapper_key-${user_info.server_id}
    async guard(asset,post_body,req) {
        if ( asset === GET_PUBLIC_KEY_FOR_RESTORE_KEY_WRAPPING_IN_CLIENT ) {
            if ( post_body.pub_wrapper_key !== undefined ) {
                if ( Object.keys(post_body.pub_wrapper_key).length != 0 ) {
                    // make sure the user has been previously stored.
                    /*
            let session_id = asset.substr(n)
            let info_access = await this.db.cache_if_found(session_id)
            if ( info_access ) {
                post_body.pub_wrapper_key
                return true
            } else {
                return false
            }
                    */
                    return true
                } else {
                    return false
                }
            }
        }

        return(true)    // true by default
    }


    async process_asset(asset_id,post_body) {
        if ( G_spotify_searcher_trns.tagged(asset_id) ) {
            let transObj = super.process_asset(asset_id,post_body)
            transObj.query = post_body.query
            transObj.offset = post_body.offset
            return(transObj)
        } else if ( asset_id === 'audio-session-transfer' ) {
            let transObj = super.process_asset(asset_id,post_body)
             for ( let ky in post_body ) {
                if ( ky in ["token", "secondary_action", "type" ] ) continue;
                transObj[ky] = post_body[ky]
            }
            transObj.secondary_action = false
            return(transObj)
        } else if ( asset_id === GET_PUBLIC_KEY_FOR_KEY_WRAPPING_IN_CLIENT ) {
            let transObj = super.process_asset(asset_id,post_body)
            transObj._user_key = post_body.user_key  // say an encrypted email
            transObj._user_machine_differentiator = post_body.device_id  // say an hash of the machine name or something...
            let key_importer = this.trans_engine ? this.trans_engine.get_import_key_function() : false
            if ( key_importer ) {
                let client_wrapper_key = await key_importer(post_body.pub_wrapper_key,["wrapKey"])
                if ( client_wrapper_key ) {
                    transObj._pub_wrapper_key = client_wrapper_key
                } else {
                    return false
                }
            } else {
                return false
            }
            transObj.secondary_action = false
            return(transObj)
        } else if ( asset_id === GET_PUBLIC_KEY_FOR_RESTORE_KEY_WRAPPING_IN_CLIENT ) {
            let transObj = super.process_asset(asset_id,post_body)
            transObj._user_key = post_body.user_key  // say an encrypted email
            transObj._user_machine_differentiator = post_body.device_id  // say an hash of the machine name or something...
            let key_importer = this.trans_engine ? this.trans_engine.get_import_key_function() : false
            if ( key_importer ) {
                let client_wrapper_key = await key_importer(post_body.pub_wrapper_key,["wrapKey"])
                if ( client_wrapper_key ) {
                    transObj._pub_wrapper_key = client_wrapper_key
                } else {
                    return false
                }
            } else {
                return false
            }
            transObj._server_id = post_body.server_id
            transObj.secondary_action = false
            return(transObj)
        } else if ( asset_id === CHUNK_POST_COM_WSSURL_REQ ) {
            let transObj = super.process_asset(asset_id,post_body)
            transObj._user_key = post_body.user_key  // say an encrypted email
            transObj.when = post_body.when
            transObj._user_machine_differentiator = post_body.device_id  // say an hash of the machine name or something...
            return(transObj)
        }
        return(super.process_asset(asset_id,post_body))
    }

    process_transition(transition,post_body,req) {
        let transObj = super.process_transition(transition,post_body,req)
        if ( G_wave_store_trns.tagged(transition) ) {
            transObj.secondary_action = false
        } else if ( G_wave_mover_trns.tagged(transition) ) {  
            // sent entire audio session
            transObj.secondary_action = false
        } else if ( G_wss_chunk.tagged(transition) || G_wss_chunk_final.tagged(transition) ||  G_wss_chunk_change.tagged(transition) ) {
            transObj.secondary_action = false
        } else {        // chunk transitions coming through wss are not checking for seconday actions... a design decision
            return super.process_transition(transition,post_body,req)
        }
        return(transObj)
    }

    //
    match(post_body,transtion_object)  {
        return true
    }

    //
    async finalize_transition(transition,post_body,elements,req) {    // like this until paging is worked out
        let finalization_state = {
            "state" : "OK",
            "OK" : "true"
        }
        if ( G_wave_store_trns.tagged(transition) ) {
            this.trans_engine.store_audio_session_component_hashes(post_body)
        } else if ( G_wave_mover_trns.tagged(transition) ) {   // sent entire audio session
            await this.trans_engine.store_audio_session_component_for_move(post_body)
        } else { // from wss connection
            if ( G_wss_chunk.tagged(transition) ) {
                this.trans_engine.store_recording_chunk(post_body)
            } else if ( G_wss_chunk_final.tagged(transition) ) {
                await this.trans_engine.store_audio_session_component_section(post_body,false)
            } else if ( G_wss_chunk_change.tagged(transition) ) {
                await this.trans_engine.store_audio_session_component_section(post_body,true)
            }
        }
        //
        return(finalization_state)
    }
}

class SongSearchAuth  extends GeneralAuth {
    constructor() {
        super(SearcherSessionManager)   // intializes general authorization with the customized session manager class.
    }
}

var session_checker = new SongSearchAuth()
module.exports = session_checker;