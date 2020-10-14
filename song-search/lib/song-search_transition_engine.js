const { GeneralTransitionEngine } = require.main.require('./lib/general_transition_engine')
const hexUtils = require.main.require('./lib/hex_utils')

//const EventEmitter = require('events')
//const cached = require('cached')
//
const web_crypto = require('webcrypto')
var g_crypto = web_crypto.crypto.subtle

const FORCE_FAIL_FETCH = "NotAnObject"
const APP_STORAGE_CLASS = "WAVE-REC"


class SessionObjectOps {

    constructor(obj) {
        this.datum = null
        this.set_datum(obj)
        this.need_info = true
    }

    storage_class() {
        return(APP_STORAGE_CLASS)
    }

    set_datum(obj) {
        this.datum = obj
    }

    set_info(chunk_info) {
        this.datum.email = chunk_info.email
        this.datum.session = chunk_info.session
        this.datum.op_time = chunk_info.client_time
        this.need_info = false
    }

    backup_chunk_hashes(blob_id) {
        this.datum.blob_list[blob_id] = this.datum.hashes
        this.datum.hashes = []
    }

    add_fields(sessCompFields) {
        let chunk_info = sessCompFields
        this.datum.blob_list[sessCompFields.blob_id] = false // makes a place holder
        if ( !this.datum.email ) this.datum.email = chunk_info.email
        if ( !this.datum.session ) this.datum.session = chunk_info.session
        if ( !this.datum.op_time ) this.datum.op_time = chunk_info.client_time
        if ( sessCompFields.chunk_final ) {
            this.datum.chunk_final = sessCompFields.chunk_final
        }
        if ( sessCompFields.chunk_change ) {
            this.datum.chunk_change = sessCompFields.chunk_change
        }
    }

    update_component(update_info) {
        this.datum.blob_list[sessCompFields.blob_id].push(his.datum.chunk_final)
        this.datum.chunk_final = update_info.chunk_final
    }

    append_chunk(chunk_info) {
       this.datum.hashes.push(chunk_info.chunk)
    }
}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//
class SongTransitionEngineClass extends GeneralTransitionEngine {
    //
    constructor() {
        super()
    }

    get_import_key_function() {
        return (jwk_key,uses) => {
            return g_crypto.importKey('jwk',
                jwk_key,
                {
                    name: "RSA-OAEP",
                    modulusLength: 4096, //can be 1024, 2048, or 4096
                    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
                    hash: { name: "SHA-256" }, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
                },
                false,
                uses
            )
        }
    }
              
    async create_aes_key() {
        let aes_key = await g_crypto.generateKey(
            {
                name: "AES-CBC",
                length: 256, //can be  128, 192, or 256
            },
            true, //whether the key is extractable (i.e. can be used in exportKey)
            ["encrypt", "decrypt"] //can be "encrypt", "decrypt", "wrapKey", or "unwrapKey"
        )
        return aes_key
    }

    async wrap_aes_key(wrapper_key,aes_key) {
        try {
            let wrapped_aes = await g_crypto.wrapKey(
                "jwk", //the export format, must be "raw" (only available sometimes)
                aes_key, //the key you want to wrap, must be able to fit in RSA-OAEP padding
                wrapper_key, //the public key with "wrapKey" usage flag
                {   //these are the wrapping key's algorithm options
                    name: "RSA-OAEP"
                }
            )
            return wrapped_aes
        } catch (e) {
            return false
        }
    }

    async unwrap_aes_key(unwrapper_key,wrapped_aes) {
        let unwrapped_aes = await g_crypto.unwrapKey(
            "jwk", // same as wrapped
            wrapped_aes, //the key you want to unwrap
            unwrapper_key, //the private key with "unwrapKey" usage flag
            {   //these are the wrapping key's algorithm options
                name: "RSA-OAEP"
            },
            {   //this what you want the wrapped key to become (same as when wrapping)
                name: "AES-CBC",
                length: 256
            },
            true, //whether the key is extractable (i.e. can be used in exportKey)
            ["encrypt", "decrypt"] //the usages you want the unwrapped key to have
        )
        //
        return unwrapped_aes
    }


    // store_recording_chunk
    // this is supposed to be the in-recording data transfer in case chunks appear in sequence while in the process of recording
    // One is sent at the end of recording in any case
    async store_recording_chunk(post_body) {
        try {
            let sessions_id = post_body.server_id
            let sess_name = post_body.session
            let transformer = this.db.file_transformer_parse
            let sessionObject = await this.db.component_cache_if_found(SessionObjectOps,sessions_id,sess_name,transformer)
            if ( sessionObject.need_info ) {
                sessionObject.set_info(post_body)
            }
            sessionObject.append_chunk(post_body)
            this.db.schedule_cache_backup()    
        } catch (e) {
        }
    }

    // store_audio_session_component_section
    // This messages comes in at the end of recording
    // Or, it comes in at the when an edit is done to the sound
    // The hash received is a combination of the hashes made from chunks and previous edits.
    async store_audio_session_component_section(post_body,do_update) {
        try {
            let sessions_id = post_body.server_id
            let sess_name = post_body.session
            let sessionObject = await this.db.store_component_section(SessionObjectOps,sessions_id,sess_name,post_body) 
            if ( sessionObject ) {
                if ( do_update ) {
                    sessionObject.update_component(post_body)
                } else {
                    sessionObject.backup_chunk_hashes(post_body.blob_id)
                }
            }
        } catch (e) {
        }
    }


    // this is for preparing to move sessions from one user device to another...
    async store_audio_session_component_for_move(post_body) {  // store for transfer... the audio session 
        try {
            let key = {'email' : post_body.email }
            let audioSessionRep = {
                'user' : key,
                'device' : post_body.device_id,
                'timestamp' : post_body.when,
                'component_data' : post_body
              }
              delete post_body.when
              delete post_body.device_id
              delete post_body.timestamp
              await this.store_audio_session(key,audioSessionRep)
        } catch (e) {
        }
    }

     // // 
     // This is the storage of a signature of stiched recording sections.
     // These may be be downloaded at the client device to an mp3 or other.
     // There should be a storage of the base64 encoding, since that is what is signed.
     async store_audio_session_component_hashes(post_body) {
        try {
            let key_value = post_body.email
            let key_field = 'email'
            let dbkey = `${key_field}-${key_value}`
            let transfer_id = await this.db.store_file_class('wave_hex_signed',dbkey,post_body)
            return transfer_id
        } catch (e) {
        }
    }

    // // 
    async retrieve_audio_session(key,sess_name) {
        try {
            let key_field = Object.keys(key)[0]
            let key_value = key[key_field]
            let dbkey = `${key_field}-${key_value}`
            //
            let session_data = await this.db.fetch_file_class('transfer',dbkey)
            if ( !(session_data) ) {
                return session_data
            }
            if ( sess_name ) {
                session_data = JSON.parse(session_data,2) // ??
                let session_component = session_data[sess_name]
                return session_component    
            } else {
                let audioSessionRep = JSON.parse(session_data)
                if ( !(audioSessionRep.wrapped_aes_key) || audioSessionRep.wrapped_aes_key.length === 0 ) return false
                audioSessionRep.wrapped_aes_key = hexUtils.hex_toByteArray(audioSessionRep.wrapped_aes_key)
                return audioSessionRep
            }
        } catch (e) {
            console.log(e)
        }
        return false
    }

    // //
    async store_audio_session(key,audioSessionRep) {
        try {
            let key_field = Object.keys(key)[0]
            let key_value = key[key_field]
            let dbkey = `${key_field}-${key_value}`
            audioSessionRep.wrapped_aes_key = hexUtils.hex_fromByteArray(audioSessionRep.wrapped_aes_key)
            let transfer_id = await this.db.store_file_class('transfer',dbkey,audioSessionRep)
            return transfer_id
        } catch (e) {
        }
    }


}


//
module.exports = new SongTransitionEngineClass()
