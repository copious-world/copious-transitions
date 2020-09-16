
// ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ----

    const CHUNK_POST_URL = `https://${self.location}/hashes/store_hash_progress`
    const STORE_ASSET_POST_URL = `https://${self.location}/hashes/store_asset`

    var g_user_info = {}
    var g_current_chunks = []       // chunk hashes
    var g_current_session_name = ""
    var g_session_changed = false

    var g_crypto = crypto.subtle
    var g_audio_db = null
    const gc_song_db_name = "SongCatcher"
    async function wv_init_database(db_name) {
        // request an open of DB
        let request = window.indexedDB.open(db_name, 2);
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
    
    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ---- ----


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

    function hex_toArrayOfBytes(hexString) {
        let result = [];
        for ( let i = 0; i < hexString.length; i += 2 ) {
          result.push(parseInt(hexString.substr(i, 2), 16));
        }
        return result;
    }

    function hex_fromArrayOfBytes(bytesArray) {
        const hexstr = bytesArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return(hexstr)
    }

    async function xor_all(chunks) {  // chunks are text hashes
        let encoded = toArrayOfBytes(start_chunk)
        let n = chunks.length
        for ( let i = 1; i < n; i++ ) {
            let next_source = toArrayOfBytes(chunks[i]);
            encoded = xor_arrays(encoded,next_source)
        }
        const hashHex = hex_fromArrayOfBytes(hashArray); // convert bytes to hex string
        return hashHex;
    }

    async function digestArray(byteArray) {
        const hashBuffer = await g_crypto.digest('SHA-256', byteArray);          // hash the message
        const hashArray = Array.from(new Uint8Array(hashBuffer));                // convert buffer to byte array
        const hashHex = hex_fromArrayOfBytes(hashArray); // convert bytes to hex string
        return hashHex;
    }

        
    function operation_response(data) {
        self.postMessage({'type': 'op_complete', 'message': data});
    }


    async function sign_hash(text) {
        //
        let signing_key = g_user_info.priv
        let enc = new TextEncoder();
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

    function store_hashes(map_id,output,hash_prefix,hashHex) {
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
                    sessionObj.hashes[map_id] = {
                        'output' : output,      // signed and sent to server
                        'combined' : hash_prefix,
                        'blob_hash' : hashHex
                    }
                }
                            //
                const request = cursor.update(sessionObj);
                request.onsuccess = () => {
                     // visual rep
                };
            }
        }
    
        let not_found_callback = () => {
            console.log(`The session ${sess_name} is not in the database`)
        }
    
        apply_find_audio_session(sess_name, audioStore, update_list_hashes_callback, not_found_callback)
    }

    async function hash_of_chunk(a_chunk) { 
        let chunkArray = await a_chunk.arrayBuffer();
        let hexHash = await digestArray(chunkArray)
        return(hexHash)
    }

    async function combined_hash(chunk_array,blob_id,new_blob,prev_blob_hash) {
        let blobArray = await new_blob.arrayBuffer();
        if ( prev_blob_hash ) {
            g_current_chunks.push(prev_blob_hash)
        }
        const hashBuffer = await g_crypto.digest('SHA-256', blobArray);
        const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
        chunk_array.push(hashHex)
        let hash_prefix = await xor_all(g_current_chunks)
        let output = hash_prefix + '|{+}|' + hashHex
        output = await sign_hash(output)
        store_hashes(blob_id,output,hash_prefix,hashHex)
        //
        return(output)
    }

    async function retrieve_hash(map_id,sess_name) {
        let transaction = g_audio_db.transaction(AUDIO_SESSION_STORE, "readwrite");
        let audioStore = transaction.objectStore(AUDIO_SESSION_STORE);
        //
        let p = new Promise((resolve,reject) => {
            let update_list_hashes_callback = (value,dbIndex) => {
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

            apply_find_audio_session(sess_name, audioStore, update_list_hashes_callback, not_found_callback)
        })
        //
       return p
    }


    async function fetch_compressed_session_from_db(sess_name,user_info) {
        let transaction = g_audio_db.transaction(AUDIO_SESSION_STORE, "readwrite");
        let audioStore = transaction.objectStore(AUDIO_SESSION_STORE);
        //
        let p = new Promise((resolve,reject) => {
            let update_list_hashes_callback = (value,dbIndex) => {
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

            apply_find_audio_session(sess_name, audioStore, update_list_hashes_callback, not_found_callback)
        })
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


    async function post_chunk(chunk_message) {

        let json =  await postData(CHUNK_POST_URL,chunk_message,'omit',true)
        return json
    }

    async function remote_data_relay(sess_data) {
        let json =  await postData(STORE_ASSET_POST_URL,sess_data,'omit',true)
        return json
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    self.onmessage = async (e) => {
        let message = e.data
        switch ( message.type ) {
            case 'init' : {             // setup operation
                let user_info = message.user
                g_user_info = user_info // ?? will the key come throug OK?
                wv_init_database(gc_song_db_name)
                break; 
            }
            case 'session' : {
                g_current_session_name = message.sess_name
                break
            }
            case 'chunk' : {            // recording chunks
                let new_chunk = message.new_chunk
                let chunk_hash = hash_of_chunk(new_chunk)
                g_current_chunks.push(chunk_hash)
                g_current_session_name = message.sess_name
                let remote_cache_op = {
                    'type' : 'chunk',
                    'chunk' : chunk_hash,
                    'user' : g_user_info.email,
                    'session' : g_current_session_name,
                    'client-time' : Date.now(),
                    'id' : g_user_info.server_id
                }
                post_chunk(remote_cache_op)
                break;
            }
            case 'benchmark' : {        // storage benchmark - hash identifying a whole session

                let op = message.op
                //edit-update, end-recording
                switch ( op ) {
                    case 'end-recording' : {        // recording stop button
                        let c_hash = await combined_hash(g_current_chunks,message.blob_id,message.blob,null)
                        let remote_cache_op = {
                            'type' : 'chunk-final',
                            'chunk-final' : c_hash,
                            'user' : g_user_info.email,
                            'session' : g_current_session_name,
                            'client-time' : Date.now(),
                            'id' : g_user_info.server_id,
                            'blob_id' : message.blob_id
                        }
                        await post_chunk(remote_cache_op)
                        // finish up with data
                        g_current_chunks = []
                        break;
                    }
                    case 'edit-update' : {          // cut, undo, etc.
                        let hashes = await retrieve_hash(message.blob_id,g_current_session_name)
                        let c_hash = await combined_hash(hashes.combined,message.blob_id,message.blob,hashes.blob_hash)
                        let remote_cache_op = {
                            'type' : 'chunk-change',
                            'chunk-change' : c_hash,
                            'user' : g_user_info.email,
                            'session' : g_current_session_name,
                            'client-time' : Date.now(),
                            'id' : g_user_info.server_id,
                            'blob_id' : message.blob_id
                        }
                        await post_chunk(remote_cache_op)
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
                    await remote_data_relay(sess_data)    
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
    self.postMessage({'type': 'status', 'status': 'ready' });
