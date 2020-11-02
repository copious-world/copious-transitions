
// ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ----

    const CHUNK_POST_COM_WSSURL_REQ = `https://${self.location.host}/song-search/guarded/dynamic/hash_progress_com_wss_url`
    const STORE_ASSET_POST_URL = `https://${self.location.host}/song-search/transition/store_waves`  // SESSION STORAGE FOR THIS DEVICE
    const SESSION_DEVICE_MOVE = `https://${self.location.host}/song-search/transition/move_waves`    // FROM THIS DEVICE TO STORAGE
    //
    const AUDIO_SESSION_STORE = 'audio_sessions'
    const AUDIO_USERID_STORE = 'audio_users'
    const AUDIO_SESSION_COMPLETE = 'audio_complete'
    const DB_VERSION = 5.0
  
    var g_user_info = {}
    var g_current_aes_key = null
    var g_current_chunks = []       // chunk hashes
    var g_current_nonces = []
    var g_current_chunk_times = []
    let g_nonce_buffer = new Uint8Array((256/8))        // 256 bits or 32 bytes 
    var g_current_session_name = "none"
    var g_current_session_machine_name = ""
    var g_session_changed = false
    var g_current_geo_location = ""

    var g_crypto = crypto.subtle
    var g_audio_db = null
    const gc_song_db_name = "SongCatcher"
    var g_app_web_socket = null

    function interaction_state(state,error) {
        if ( error ) {
            //
        } else {
            self.postMessage({'type': 'status', 'status': state });
        }
    }

    function interaction_info(info) {
        self.postMessage({'type': 'info-ws', 'status': info });
    }

// ---- ---- ---- ---- ---- ---- ---- ---- ----

    //>--
    function get_client_device_name() {
        let oscpu = navigator.oscpu
        let ua = navigator.userAgent
        let user_given_machine_name = g_current_session_machine_name
        //
        let b = `${oscpu}-${ua}-${user_given_machine_name}`
        b = encodeURIComponent(b.trim())
        return(b)
    }
    //--<


    async function wv_init_database(db_name) {
        // request an open of DB
        let request = self.indexedDB.open(db_name, DB_VERSION);
        //
        request.onerror = (event) => {
            console.log("This web app will not store recorded audio without the use of computer storage.")
        };
        request.onsuccess = (event) => {
            //
            let db = event.target.result;
            db.onerror = (event) => {
                console.log("Database error: " + event.target.error);
            };
            //
            g_audio_db = db;
        };
    }

    //
    function apply_find_audio_session(sess_name, store, success_callback, not_found_callback) {
        //
        var nameIndex = store.index('name');
        nameIndex.get(sess_name).onsuccess = (evt) => {
            var value = evt.target.result;
            if ( value ) {
            if ( success_callback ) success_callback(value,nameIndex);
            } else {
            if ( not_found_callback ) not_found_callback();
            }
        };
        //
    }
    

    function operation_response(data) {
        self.postMessage({'type': 'op_complete', 'message': data});
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    // HANDLE HEX AND BYTE ARRAYS
    //>--
    function hex_fromArrayOfBytes(arrayOfBytes) {
        const hexstr = arrayOfBytes.map(b => b.toString(16).padStart(2, '0')).join('');
        return(hexstr)
    }
    //--<

    //>--
    function hex_fromTypedArray(byteArray){
        let arrayOfBytes = Array.from(byteArray)
        return(hex_fromArrayOfBytes(arrayOfBytes))
    }
    //--<

    //>--
    function hex_fromByteArray(byteArray){
        return hex_fromTypedArray(ArrayOfBytes_toByteArray(byteArray))
    }
    //--<

    //>--
    function hex_toArrayOfBytes(hexString) {
        let result = [];
        for ( let i = 0; i < hexString.length; i += 2 ) {
        result.push(parseInt(hexString.substr(i, 2), 16));
        }
        return result;
    }
    //--<

    //>--
    function hex_toByteArray(hexstr) {
        let aob = hex_toArrayOfBytes(hexstr)
        return ArrayOfBytes_toByteArray(aob)
    }
    //--<

    //>--
    function ArrayOfBytes_toByteArray(arrayOfBytes) {
        let byteArray = new Uint8Array(arrayOfBytes)
        return(byteArray)
    }
    //--<

    //>--
    function xor_arrays(a1,a2) {
        let n = Math.min(a1.length,a2.length)
        let N = Math.max(a1.length,a2.length)
        //
        let output = []
        for ( let i = 0; i < n; i++ ) {
            let a = a1[i]
            let b = a2[i]
            output.push(a ^ b)
        }
        let rest = a1.length > a2.length ? a1.slice(n,N) :  a2.slice(n,N)
        output = output.concat(rest)
        return(output)
    }
    //--<

    //>--
    function xor_byte_arrays(ba1,ba2) {
        let n = Math.min(ba1.length,ba2.length)
        let N = Math.max(ba1.length,ba2.length)
        // -- make the new array out of the longer array
        let xored = ba1.length > ba2.length ? new Uint8Array(ba1) : new Uint8Array(ba2)
        for ( let i = 0; i < n; i++ ) { // xor in the shorter array
            xored[i] = ba1[2] ^ ba1[i]
        }
        return xored
    }
    //--<

    //>--
    function hex_xor_of_strings(str1,str2) {
        let bytes1 = hex_toArrayOfBytes(str1)
        let bytes2 = hex_toArrayOfBytes(str2)
        //
        let xored = xor_arrays(bytes1,bytes2)
        return(hex_fromArrayOfBytes(xored))
    }
    //--<

    //>--
    // xor_all
    //  -- 
    function xor_all_to_hex_str(hexs_chunks) {  // chunks are text hashes
        let start_chunk = hexs_chunks[0]
        let encoded = hex_toArrayOfBytes(start_chunk)
        let n = hexs_chunks.length
        for ( let i = 1; i < n; i++ ) {
            let next_source = hex_toArrayOfBytes(hexs_chunks[i]);
            encoded = xor_arrays(encoded,next_source)
        }
        const hashHex = hex_fromArrayOfBytes(encoded); // convert bytes to hex string
        return hashHex;
    }
    //--<



    //>--
    // geo_loc_str_to_byte_array
    //  -- 
    function geo_loc_str_to_byte_array(loc_str) {
        let loc = null
        try {
            loc = JSON.parse(loc_str)
            if ( (loc.latitude === undefined) || (loc.longitude === undefined) ) {
                loc = g_current_geo_location
            }
        } catch(e) {
            loc = g_current_geo_location
        }
        let lat = '' + loc.latitude
        let long = '' + loc.longitude
        lat = lat.replace('.','')
        long = long.replace('.','')
        let stringup = lat + long
        let array = hex_toArrayOfBytes(stringup)
        return(array)
    }
    //--<


    //>--
    // wv_nowrap_decrypted_local_priv_key
    // --
    async function wv_nowrap_decrypted_local_priv_key(key_bytes,unwrapped_aes,iv_buffer) {
        //
        let clear_key = await g_crypto.decrypt({
                                                    name: "AES-CBC",
                                                    iv : iv_buffer
                                                },unwrapped_aes,key_bytes)
        //
        let dec = new TextDecoder()
        let txt = dec.decode(clear_key)
        let clear_jwk = JSON.parse(txt)
        //
        let key = await g_crypto.importKey('jwk',clear_jwk,{
                'name': "ECDSA",
                'namedCurve': "P-384"
            },
            true,
            ["sign"]
        )
        return key
    }
    //--<

    //>--
    // import_signing_key
    //  -- 
    async function import_signing_key(encrypted_key,aes_key,iv_buffer) {
        if ( aes_key !== null ) {
            let enckey = hex_toByteArray(encrypted_key)
            let priv_key = await wv_nowrap_decrypted_local_priv_key(enckey,aes_key,iv_buffer)
            return priv_key
        }
        return false
    }
    //--<
    
    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    // HANDLE HEX AND BYTE ARRAYS
  
    async function encrypt_hash(hashAsBytes) {
        // do nothing for now...
    }

    //>--
    // digestByteArray
    //  Xor a nonce onto the data bytes take from the Blob.
    //  Then use SHA-256 to hash the result. 
    //  Return the SHA hash as a hex string.
    //  -- 
    async function digestByteArray(byteArray,secret) {
        if ( secret ) {  // the secret has to match the Uint8Array type
            byteArray = new Uint8Array(byteArray)  // copy the array
            byteArray = xor_byte_arrays(byteArray,secret)
        }
        const hashBuffer = await g_crypto.digest('SHA-256', byteArray);          // hash the message
        const hashAsBytes = new Uint8Array(hashBuffer)
        // await encrypt_hash(hashAsBytes)
        const hashArray = Array.from(hashAsBytes);                // convert buffer to byte array
        const hashHex = hex_fromArrayOfBytes(hashArray); // convert bytes to hex string
        return hashHex;
    }
    //--<


    //>--
    // hash_of_chunk
    //
    //  Get the array of bytes from a blob (audio blob, e.g.)
    //  -- 
    async function hash_of_chunk(a_chunk,secret) {
        let chunkArray = await a_chunk.arrayBuffer();   // a_chunk is a blob
        let hexHash = await digestByteArray(chunkArray,secret)
        return(hexHash)
    }
    //--<

    //>--
    // sign_hash
    // --
    // sign with the private key of the user on the device...
    async function sign_hash(text,signing_key) {
        //
        let enc = new TextEncoder();   // one each time or one for app ???
        let encoded =  enc.encode(text);
        let signature = await g_crypto.sign({
                                                name: "ECDSA",
                                                hash: {name: "SHA-256"},
                                            },
                                            signing_key,
                                            encoded
                                        );
        return(signature)
    }
    //--<
    
    async function sign_hex_of(b64blob) {  // blob is base64 encoded
        let output = await sign_hash(b64blob,g_user_info.priv)
        return output
    }

    function store_hashes_and_nonces(map_id,hashObj) {
        let p = new Promise((resolve,reject) => {
            let sess_name = g_current_session_name
            let transaction = g_audio_db.transaction(AUDIO_SESSION_STORE, "readwrite");
            let audioStore = transaction.objectStore(AUDIO_SESSION_STORE);
            //
            let update_list_hashes_callback = (value,dbIndex) => {
                let keyRangeValue = IDBKeyRange.only(value.name);
                dbIndex.openCursor(keyRangeValue).onsuccess = (event) => {
                    var cursor = event.target.result;
                    if ( cursor ) {
                        let sessionObj = cursor.value
                        sessionObj.hashes[map_id] = hashObj
                        cursor.update(sessionObj);
                        resolve(true)
                    }
                }
            }

            let not_found_callback = () => {
                reject(false)
                console.log(`The session ${sess_name} is not in the database`)
            }
        
            apply_find_audio_session(sess_name, audioStore, update_list_hashes_callback, not_found_callback)
        })
        return p
    }


    // combined_hash_signed_and_store
    // parameters:
    //  hexs_chunk_array - either the new hashes from audio chunks or stored ones from previous recording and return to edit
    //  blob_id - the id for local storage and/or identifying this as part of the larger sessions container
    //  new_blob - this is the combined blob data of all gathered chunks for a sessions of a named session
    //  prev_blob_hash (optional) - provided during the editing of a section... this will be incorporated
    //
    async function combined_hash_signed_and_store(hashObj,blob_id,new_blob,prev_blob_hash) {
        let is_new_storage = prev_blob_hash ? false : true // store the history of changes if the parameter is provided
        // hexs_chunk_array passed
        let nonces = is_new_storage ? g_current_nonces : hashObj.nonces
        let times = is_new_storage ? g_current_chunk_times : hashObj.times
        let hexs_chunk_array = is_new_storage ? g_current_chunks :  hashObj.hashed_chunks
        //
        if ( is_new_storage ) {     // demarcate data representation from editing history representation
            nonces.push("0")
            hexs_chunk_array.push("0")
            times.push("0")
        } else {
            hexs_chunk_array.push(prev_blob_hash)   // previous result of this function
        }
        
        // hash
        let blobArray = await new_blob.arrayBuffer();          // -- recorded data
        const hashBuffer = await g_crypto.digest('SHA-256', blobArray);     // SHA 256
        //  convert to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
        const hashHex_suffix = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
        // add to the hash list
        hexs_chunk_array.push(hashHex_suffix)
        //
        let hx_time = Date.now().toString(16)
        times.push(hx_time)             // ensuing times correspond to first store and edits.
        let last_loc_bytes = geo_loc_str_to_byte_array(hashObj.sess_geo_location)
        let stored_token = hashHex_suffix 
        if ( last_loc_bytes ) {
            let a_view = new Uint8Array(hashHex_suffix)
            let o_array = [...a_view]
            let xored = xor_arrays(last_loc_bytes,o_array)
            hashHex_suffix = hex_fromArrayOfBytes(xored)
            hashHex_suffix = hex_xor_of_strings(hashHex_suffix,hx_time)
        }
        //
        //
        // get an xor of all the hashes in the chunk array
        let hash_prefix = xor_all_to_hex_str(hexs_chunk_array)
        //
        let output = hash_prefix + '|{+}|' + hashHex_suffix  // the hex of the xor of chunk hashses... with the hex of the Sha2 hash of blob
        //        
        output = await sign_hash(output,g_user_info.priv)
        let hashObjUpdate = {
            'hash_combo' : stored_token,      // signed and sent to server
            'combined' : hash_prefix,
            'blob_hash' : hashHex,
            'nonces' : nonces,
            'hashed_chunks' : hashed_chunks,
            'times' : times
        }
        //
        for ( let hky in hashObjUpdate ) {
            hashObj[hky] = hashObjUpdate[hky]
        }
        //
        await store_hashes_and_nonces(blob_id,hashObj)
        //
        return(output)
    }


    // retrieve_hash_from_db
    //      A benchmark has has been stored... This gets it and does no operations on it.
    async function retrieve_hash_from_db(map_id,sess_name) {
        let transaction = g_audio_db.transaction(AUDIO_SESSION_STORE, "readwrite");
        let audioStore = transaction.objectStore(AUDIO_SESSION_STORE);
        //
        let p = new Promise((resolve,reject) => {
            let get_listed_hash_callback = (value,dbIndex) => {
                let keyRangeValue = IDBKeyRange.only(value.name);
                dbIndex.openCursor(keyRangeValue).onsuccess = (event) => {
                    var cursor = event.target.result;
                    if ( cursor ) {
                        let sessionObj = cursor.value
                        let result = sessionObj.hashes[map_id]
                        resolve(result)
                    }
                }
            }
        
            let not_found_callback = () => {
                reject(`The session ${sess_name} is not in the database`)
            }

            apply_find_audio_session(sess_name, audioStore, get_listed_hash_callback, not_found_callback)
        })
        //
       return p
    }


    async function fetch_compressed_session_from_db(sess_name) {
        let transaction = g_audio_db.transaction(AUDIO_SESSION_COMPLETE, "readwrite");
        let audioStore = transaction.objectStore(AUDIO_SESSION_COMPLETE);
        //
        let p = new Promise((resolve,reject) => {
            let get_governing_session_callback = (value,dbIndex) => {
                let keyRangeValue = IDBKeyRange.only(value.name);
                dbIndex.openCursor(keyRangeValue).onsuccess = (event) => {
                    var cursor = event.target.result;
                    if ( cursor ) {
                        let sessionObj = cursor.value
                        resolve(sessionObj)
                    }
                }
            }
            //
            let not_found_callback = () => {
                reject(`The session ${sess_name} is not in the database`)
            }
            //
            apply_find_audio_session(sess_name, audioStore, get_governing_session_callback, not_found_callback)
        })
        return p
    }


    
    async function fetch_session_from_db(sess_name) {
        let transaction = g_audio_db.transaction(AUDIO_SESSION_STORE, "readwrite");
        let audioStore = transaction.objectStore(AUDIO_SESSION_STORE);
        //
        let p = new Promise((resolve,reject) => {
            let get_governing_session_callback = (value,dbIndex) => {
                let keyRangeValue = IDBKeyRange.only(value.name);
                dbIndex.openCursor(keyRangeValue).onsuccess = (event) => {
                    var cursor = event.target.result;
                    if ( cursor ) {
                        let sessionObj = cursor.value
                        resolve(sessionObj)
                    }
                }
            }
            //
            let not_found_callback = () => {
                reject(`The session ${sess_name} is not in the database`)
            }
            //
            apply_find_audio_session(sess_name, audioStore, get_governing_session_callback, not_found_callback)
        })
        return p
    }

    
    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ---- ----

    async function postData(url = '', data = {}, creds = 'omit', do_stringify = true,ctype) {
      let content_type = 'application/json'
      if ( ctype !== undefined ) {
        content_type = ctype
      }
      let options = {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: creds, // include, *same-origin, omit
        headers: {
          'Content-Type': content_type
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *client
        body: (do_stringify ? JSON.stringify(data)  : data)	// body data type must match "Content-Type" header
      }

      if ( ctype === 'multipart/form-data') {
        delete options.headers['Content-Type']  // content type will be set automatically with a boundary
      }

      // Default options are marked with *
      const response = await fetch(url, options);
      if ( response.ok == false ) {
        console.log(response.status + ': ' + response.statusText)
        return {}
      } else {
        return await response.json(); // parses JSON response into native JavaScript objects
      }
    }


    var g_wss_active_session_id = "nothing"
    function set_current_app_ws_id(ws_id) {
        g_wss_active_session_id = ws_id
    }

    function post_chunk(chunk_data) {
        let chunk_message = JSON.stringify(chunk_data)
        g_app_web_socket.send(chunk_message)
    }

    async function remote_signed_data_relay(sess_data) {
        let blob = sess_data.blob
        let signature = await sign_hex_of(blob)
        sess_data.blob = hex_fromByteArray(signature)
        let json =  await postData(STORE_ASSET_POST_URL,sess_data,'omit',true)
        return json
    }

    async function remote_data_transfer(sess_data) {
        delete sess_data.blob
        // sending the data array container wav and ogg sections
        let json =  await postData(SESSION_DEVICE_MOVE,sess_data,'omit',true)
        return json
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    self.onmessage = async (e) => {
        let message = e.data
        switch ( message.type ) {
            case 'a_key' : {
                g_current_aes_key = message.key
                break;
            }
            case 'init' : {             // setup operation
                try {
                    let user_info = message.user
                    g_current_session_machine_name = user_info.machine_name ? user_info.machine_name : 'tester'
                    g_user_info = user_info // ?? will the key come through OK?
                    user_info.priv = await import_signing_key(g_user_info.encrypted_key,g_current_aes_key,message.iv)
                    wv_init_database(gc_song_db_name)
                    g_app_web_socket = await web_socket_initializer(user_info)
                    interaction_state('ready')
                } catch(error) {
                    interaction_state('fail-init')
                }
                break; 
            }
            case 'session' : {
                g_current_session_name = message.sess_name
                break
            }
            case 'geolocation' : {
                g_current_geo_location = message.geo_location
                break;
            }
            case 'chunk' : {            // recording chunks
                // as chunks are gathered during recording save hashes of them
                g_current_session_name = message.sess_name
                // The chunk in raw form is in the client for sound playback.
                let new_chunk = message.chunk
                let chunk_time = Date.now()
                let hx_chunk_time = chunk_time.toString(16);
                crypto.getRandomValues(g_nonce_buffer);
                let time_array = hex_toByteArray(hx_chunk_time)
                let secret = xor_byte_arrays(g_nonce_buffer,time_array)
                // -- hash_of_chunk -- SHA-256 of xor with secret  = (time ^ data) ^ random = (time ^ random) ^ data
                let chunk_hash = await hash_of_chunk(new_chunk,secret)  // chunk has is a string in the hex alphabet
                // STORE HASH LOCALLY -- not yet in DB -- the chunk is in the DB
                g_current_chunks.push(chunk_hash)
                let nonce_hx_str = hex_fromTypedArray(g_nonce_buffer)  // a string
                g_current_nonces.push(nonce_hx_str)
                g_current_chunk_times.push(hx_chunk_time)
                // STORE HASH REMOTELY           // STORE HASH REMOTELY
                let remote_cache_op = {
                    'transition' : 'chunk',
                    'message' : {
                        'chunk' : chunk_hash,
                        'email' : g_user_info.email,
                        'session' : g_current_session_name,
                        'client_time' : chunk_time,
                        'server_id' : g_user_info.server_id
                    }       // there is no blob id yet...
                }
                post_chunk(remote_cache_op)  // send updates to the server (short message)
                break;
            }
            case 'benchmark' : {        // storage benchmark - hash identifying a whole session
                //
                let op = message.op
                //edit-update, end-recording
                switch ( op ) {
                    case 'end-recording' : {        // recording stop button to db
                        // message.blob_id -- a uuid, made for the blob
                        // next get the session data for this blob from the DB
                        let hashes = await retrieve_hash_from_db(message.blob_id,g_current_session_name)
                        // message.blob -- the audio blob, made from the chunks gathered - real time.
                        let c_hash = await combined_hash_signed_and_store(hashes,message.blob_id,message.blob,null)
                         // STORE HASH REMOTELY  // STORE HASH REMOTELY
                        let remote_cache_op = {
                            'transition' : 'chunk-final',
                            'message' : {
                                'chunk_final' : c_hash,
                                'email' : g_user_info.email,
                                'session' : g_current_session_name,
                                'client_time' : Date.now(),
                                'server_id' : g_user_info.server_id,    // identifies the user recording session
                                'blob_id' : message.blob_id             // UUID from web page
                            }
                        }
                        post_chunk(remote_cache_op)
                        // discard data mapping to chunks gathhered while recording
                        g_current_chunks = []
                        g_current_nonces = []
                        g_current_chunk_times = []
                        break;
                    }
                    case 'edit-update' : {          // cut, undo, etc.
                        // message.blob_id -- a uuid, made for the blob - stays the same after edits, etc.
                        // next get the session data for this blob from the DB
                        let hashes = await retrieve_hash_from_db(message.blob_id,g_current_session_name)
                        // message.blob -- the audio blob, made from the chunks gathered - real time - and then edited
                        // make a new hash for the edit
                        let edit_ops = JSON.stringify(hashes.operations)
                        let c_hash = await combined_hash_signed_and_store(hashes,message.blob_id,message.blob,hashes.blob_hash)
                        let remote_cache_op = {
                            'transition' : 'chunk-change',
                            'message' : {
                                'chunk_change' : c_hash,
                                'email' : g_user_info.email,
                                'session' : g_current_session_name,
                                'client_time' : Date.now(),
                                'server_id' : g_user_info.server_id,
                                'blob_id' : message.blob_id,
                                'ops' : edit_ops
                            }
                        }
                        post_chunk(remote_cache_op)
                        break;
                    }
                    default: {      // error condition
                        break;
                    }
                }
                break;
            }
            case 'storage' : {          // send a complete session
                let sess_name = message.sess_id
                try {
                    let sess_data = await fetch_compressed_session_from_db(sess_name)
                    sess_data.email = g_user_info.email
                    sess_data.sess_id = g_user_info.server_id
                    delete sess_data.pub_verification_key  // keep the verification key here if the signer key is lost, then put trust apart from signature
                    await remote_signed_data_relay(sess_data)    
                } catch (e) {
                    // ----
                }
                break;
            }
            case 'device-move' : {          // send a complete session
                let sess_name = message.sess_id
                try {
                    let sess_data = await fetch_session_from_db(sess_name)
                    sess_data.email = g_user_info.email
                    sess_data.sess_id = g_user_info.server_id
                    sess_data.device_id = get_client_device_name()
                    
                    await remote_data_transfer(sess_data)    
                } catch (e) {
                    // ----
                }
                break;
            }
            case 'shutdown' : {         // unfinished business
                // ...
                self.postMessage({'type': 'status', 'status': 'shutdown'});
                break;
            }
            default : { // error condition
                break;
            }
        }

    };


    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- 

    var g_com_url = ""
    async function web_socket_initializer(user_info) {
        try {
            let chunk_com_req = {
                'user_key' : user_info.email,
                'when' : Date.now(),
                "device_id" : get_client_device_name()
            }
            let json =  await postData(CHUNK_POST_COM_WSSURL_REQ,chunk_com_req,'omit',true)
            if ( json ) {
                let com_url = json.url
                g_com_url = com_url
                let p = new Promise((resolve,reject) => {
                    let socket = new WebSocket(`wss://${self.location.host}/${g_com_url}`);   // wss ... forcing this onto a secure channel
                    let opened = false
                    socket.onopen = (event) => {
                        opened = true
                        resolve(socket)
                    };
                    //
                    //
                    socket.onmessage = (event) => {
                        if ( event.data !== undefined ) {
                            try {
                                let msg = JSON.parse(event.data)
                                if ( msg.data && (msg.data.type === 'ws_id') ) {
                                    let local_ws_id = msg.ws_id
                                    if ( msg.data.status === "connected" ) {
                                        set_current_app_ws_id(local_ws_id)
                                    }
                                } else if ( msg.data && (msg.data.type === 'ping') ) {
                                    if ( g_app_web_socket ) {
                                        let ponger = {
                                            "ping_id" : msg.data.ping_id,
                                            "time" : Date.now()
                                        }
                                        g_app_web_socket.send(JSON.stringify(ponger))
                                    }
                                } else {
                                    if ( g_expected_response ) {
                                        g_expected_response.resolve(msg)
                                    } else {
                                        interaction_info(msg)
                                    }    
                                }
                            } catch (e) {}
                        }
                    };
                    
                    socket.onclose = async (event) => {
                      if (event.wasClean) {
                        interaction_state('closed')
                      } else {
                        // try to re-open
                        if ( !opened ) {
                            interaction_state('error-server')
                        } else {
                            try {
                                g_app_web_socket = await web_socket_initializer(g_user_info)
                                interaction_state('restored')    
                            } catch(error) {
                                interaction_state('fail-ws-no-recover')
                            }
                        }
                      }
                      clearTimeout(socket._pingTimeout);
                    };
                    
                    socket.onerror = (error)  => {
                        if ( !opened ) {
                            interaction_state('error-server')
                            reject(error)
                        } else {
                            if ( g_expected_response ) { g_expected_response.reject(error) }
                            interaction_state('error-ws',error)
                        }
                    };
                                  
                })
                return p
            }
        } catch (e) {
            throw e
        }
    }
