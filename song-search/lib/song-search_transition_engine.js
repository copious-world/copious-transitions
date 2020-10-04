const { GeneralTransitionEngine } = require.main.require('./lib/general_transition_engine')
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
    }

    backup_chunk_hashes() {
        this.datum.blob_list[sessCompFields.blob_id] = this.datum.hashes
        this.datum.hashes = []
    }

    add_fields(sessCompFields) {
        this.datum.blob_list[sessCompFields.blob_id] = false
        if ( !this.datum.email ) this.datum.email = chunk_info.email
        if ( !this.datum.session ) this.datum.session = chunk_info.session
        if ( !this.datum.op_time ) this.datum.op_time = chunk_info.client_time
        this.datum.chunk_final = sessCompFields.chunk_final
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


    async store_recording_chunk(post_body) {
        try {
            let sessions_id = post_body.id
            let sess_name = post_body.session
            let sessionObject = await this.db.component_cache_if_found(SessionObjectOps,sessions_id,sess_name)
            if ( sessionObject.need_info ) {
                sessionObject.set_info(post_body)
            }
            sessionObject.append_chunk(post_body)
            this.db.schedule_cache_backup()    
        } catch (e) {
        }
    }

    async store_audio_session_component_section(post_body,do_update) {
        try {
            let sessions_id = post_body.id
            let sess_name = post_body.session
            let sessionObject = await this.db.store_component_section(sessions_id,sess_name,post_body) 
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

    async store_audio_session_component(post_body) {  // store for transfer... the audio session 
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
     async store_audio_session_component_hashes(post_body) {
        try {
            let key_value = post_body.email
            let key_field = 'email'
            let dbkey = `${key_field}-${key_value}`
            let transfer_id = await this.db.store_file_class('wave_hex_signed',dbkey,audioSessionRep)
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
            if ( sess_name ) {
                session_data = JSON.parse(session_data,2) // ??
                let session_component = session_data[sess_name]
                return session_component    
            } else {
                return JSON.parse(session_data)
            }
        } catch (e) {
        }
    }

    async store_audio_session(key,audioSessionRep) {
        try {
            let key_field = key.key(0)
            let key_value = key[key_field]
            let dbkey = `${key_field}-${key_value}`
            let transfer_id = await this.db.store_file_class('transfer',dbkey,audioSessionRep)
            return transfer_id
        } catch (e) {
        }
    }


}


//
module.exports = new SongTransitionEngineClass()
