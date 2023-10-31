
const AppLifeCycle = require("./general_lifecyle")
const fs_pr = require('fs/promises')


/** 
 * The General Transition Engine provides basic transitions for files and media while keeping the 
 * abstraction for managing and executing transtions which may be of varying complexity and asynchronicity.
 * 
 * Ideally, the most advanced transition engine will operate distributed ATMs or Petri nets with the web interface
 * taking part a an active input driver from among many input drivers.
 * 
 * 
 * NOTE: all the base classes in /lib return the class and do not return an instance. Explore the applications and 
 * the reader will find that the descendant modules export instances. The classes provided by copious-transitions must
 * be extended by an application.
 * 
 * @memberof base
 */

class GeneralTransitionEngImpl extends AppLifeCycle {
    //
    constructor() {
        super()
        this.db = null
        this.statics = null
        this.dynamics = null
        this._uploader_managers = {}
        this.root_path = process.cwd()
        //
        this.trans_processor = false
        this.user_processor = false
        this.endpoint_service = false
        this.web_sockets = false
    }

    /**
     * 
     * @param {object} conf 
     * @param {object} db 
     */
    initialize(conf,db) {
        this.conf = conf
        this.db = db
    }

    /**
     * 
     * @param {object} statics_assets 
     * @param {object} dynamics_assets 
     * @param {object} sessions 
     */
    install(statics_assets,dynamics_assets,sessions) {
        this.sessions = sessions
        this.statics = statics_assets
        this.dynamics = dynamics_assets
        this.statics.set_transition_engine(this)
        this.dynamics.set_transition_engine(this)
        dynamics_assets.import_keys(this.get_import_key_function())
    }


    /**
     * 
     * @param {object} trans_processor 
     * @param {object} user_processor 
     * @param {object} mime_processor 
     */
    set_contractual_filters(trans_processor,user_processor,mime_processor) {
        this.trans_processor = trans_processor
        this.user_processor = user_processor
        this.mime_processor = mime_processor
    }



    /**
     * Accepts a reference to the application supplied web socket server manager and sets the `web_sockets` field to it.
     * 
     * @param {object} web_sockets - the reference to the application supplied web socket server manager.
     */
    set_ws(web_sockets) {
        this.web_sockets = web_sockets
    }


    /**
     * 
     * @returns {string|boolean}
     */
    get_import_key_function() {
        return(false)
    }

    /**
     * 
     * @param {Buffer} blob_data 
     * @returns {Buffer}
     */
    chunks_to_data(blob_data) {
        return Buffer.concat(blob_data)
    }


    /**
     * 
     * @param {object} file_descriptor 
     * @param {string} target_path 
     * @param {object} trans_obj 
     * @param {Function} cb 
     * @returns {Number}
     */
    async file_mover(file_descriptor,target_path,trans_obj,cb) {
        file_descriptor.mv(target_path,cb)
        return(Math.floor(Math.random()*10000)) // default random int
    }

    /**
     * 
     * @param {object} file_descriptor 
     * @param {string} target_path 
     * @param {string} writeable_data 
     * @param {string} id 
     * @returns {string}
     */
    async store_data(file_descriptor,target_path,writeable_data,id) {
        await fs_pr.writeFile(target_path,writeable_data)
        return id
    }


    async update_meta_descriptors(post_body,ids) {}

    alt_store() { return false }
    app_pack_data(blob_data) {}


    // chunk_mover
    // per file chunk mover
    /**
     * 
     * @param {string} token 
     * @param {object} file_descriptor 
     * @param {string} target_path 
     * @param {Function} cb 
     * @returns {string|Function}
     */
    async chunk_mover(token,file_descriptor,target_path,cb) {
        //
        let chunk_manager = this._uploader_managers[token]
        let blob_data = false
        if ( chunk_manager._chunks !== undefined ) {            // ONE FILE -- one array of chunks
            blob_data = chunk_manager._chunks
        } else if ( chunk_manager._chunkers !== undefined ) {       // MANY FILES -- map file names to arrays of chunks
            blob_data = chunk_manager._chunkers[file_descriptor.name]
        } else {
            // COULD NOT PERFORM OP
            return false
        }
        let id = false
        if ( blob_data ) {
            let writeable_data = this.alt_store() ? this.app_pack_data(blob_data) : this.chunks_to_data(blob_data)
            id = await this.store_data(file_descriptor,target_path,writeable_data,id)   
        }
        try {
            if ( cb ) cb()
        } catch (e) {}
        //
        return(id)
    }

    /**
     * Set up a data structure that can be found by the ...transaction token... 
     * and that refers to an array that can receive chunks (one or more files as separate cases)
     * when a file list is givent, the files are keyed by the file name under the transaction token 
     * -> (file names will not be confused with other sessions)
     * 
     * @param {object} post_body 
     * @param {string} token 
     */
    files_coming_in_chunks(post_body,token) {
        let chunk_manager = Object.assign({},post_body)
        if ( post_body.file_list ) {            // MULTIPLE FILES. for clients sending more than one file, a list is expected beyond the typical form field list
            chunk_manager._chunkers = {}
            for ( let file of post_body.file_list ) {   // EACH of file list
                if ( file.file_name !== undefined ) {
                    chunk_manager._chunkers[file.file_name] = []   // chunks  // each file in the list has to have at least a name
                }
            }
        } else {
            chunk_manager._chunks = []          // ONE FILE only
        }
        this._uploader_managers[token] = chunk_manager    // <-- transaction token gets a chunk manager
    }

    //
    /**
     * 
     * @param {object} post_body 
     * @param {string} files 
     * @returns {object} - `finalization_state` 
     */
    async upload_chunk(post_body,files) {
        if ( !files || Object.keys(files).length === 0) {
            let finalization_state = {
                "state" : "failed",
                "OK" : false
            }
            return finalization_state
        }
        //
        let token = post_body.token
        let f_keys =  Object.keys(files)
        let chunk_manager = this._uploader_managers[token]
        if (  (f_keys.length === 1) && chunk_manager._chunks ) {         // Handling one file
            let file = files[f_keys[0]]
            if ( file.data ) {
                chunk_manager._chunks.push(file.data)
            } else if ( typeof file === "string" ) {
                chunk_manager._chunks.push(file)
            }
        } else {                            // Handling multiple files
            // in a sequece of chunks one or more files may be identified in the post body
            // the client will seize to send the smaller files while larger ones will be sent 
            // until post bodies indicate that there is no more data to come.
            if ( chunk_manager._chunkers ) {
                for ( let file_key in files ) {
                    let file = files[file_key]
                    let chunk_array = chunk_manager._chunkers[file_key]
                    if ( file && chunk_array ) {
                        if ( file.data ) {
                            chunk_array.push(file.data)
                        } else if ( typeof file === "string" ) {
                            chunk_array.push(file)
                        }
                    }
                }    
            }
        }
        let finalization_state = {
            "state" : "next",
            "OK" : true
        }
        return finalization_state
    }


    /**
     * 
     * @param {object} post_body 
     * @param {object} ttrans 
     * @returns {object} - `finalization_state` 
     */
    async chunks_complete(post_body,ttrans) {
        //
        let ids =  []
        let token = post_body.token

        if ( this._uploader_managers[token] !== undefined )  {
            // the file_list is sent in the body. 
            // they may have fallen out from the upload process.
            // But, it is expected that the client will send the list of all files
            // in the completion post body.
            if ( post_body.file_list ) {        // MORE THAN ONE
                for ( let uploaded_file of post_body.file_list ) {
                    let ext = uploaded_file.ext ? uploaded_file.ext : "media"
                    let file_differentiator = ttrans.file_entry_id("file")
                    let store_name = `${uploaded_file.name}${file_differentiator}.${ext}`
                    let dir = ttrans.directory()
                    //
                    let file_id = await this.chunk_mover(token,uploaded_file,dir + '/'  + store_name,false)
                    if ( file_id !== false ) {      // failed transaction will not return identifiers
                        ids.push(file_id)
                    }
                }
            } else {        // JUST ONE
                let uploaded_file = post_body.file
                let ext = post_body.ext ? post_body.ext : "media"
                let file_differentiator = ttrans.file_entry_id("file")
                let store_name = `${uploaded_file.name}${file_differentiator}.${ext}`
                let dir = ttrans.directory()
                //
                let file_id = await this.chunk_mover(token,uploaded_file,dir + '/'  + store_name,false)
                if ( file_id !== false ) {      // failed transaction will not return identifiers
                    ids.push(file_id)
                }
            }

        }
        //
        let finalization_state = {
            "state" : "stored",
            "OK" : "true",
            "ids" : ids
        }
        return finalization_state
    }

    //
    /**
     * 
     * @param {object} post_body 
     * @param {object} ttrans 
     * @param {Array} files 
     * @param {object} req 
     * @returns {object} - `finalization_state` 
     */
    async upload_file(post_body,ttrans,files,req) {
        //
        if ( !files || Object.keys(files).length === 0) {
            let finalization_state = {
                "state" : "failed",
                "OK" : false
            }
            return finalization_state
        }
        //
        let ukey = ttrans.primary_key()
        let proto_file_name = post_body[ukey]
        let file_name_base = ttrans.transform_file_name(proto_file_name)
        let ext = post_body.file_type
        //
        let ids =  []
        for ( let file_key in files ) {
            let uploaded_file = files[file_key]
            let file_differentiator = ttrans.file_entry_id(file_key)
            // mv is part of the express.js system
            let store_name = `${file_name_base}${file_differentiator}.${ext}`
            let dir = ttrans.directory()
            let udata = {
                'name' : proto_file_name,
                'id-source' : ukey,
                'id' : proto_file_name,
                'pass' : '',
                'dir' : dir,
                'file' : store_name
            }
            ttrans.update_file_db_entry(udata)
            let file_id = await this.file_mover(uploaded_file,dir + '/'  + store_name,ttrans,((uudata,ureq) => {
                    return((err) => {
                        if ( err ) {
                            if ( this.sessions ) {
                                this.sessions.session_accrue_errors("upload",uudata,err,ureq)
                            }
                        } else {
                            this.db.store("upload",uudata)
                        }
                    });
                })(udata,req),udata)    
            //
            ids.push(file_id)
        }
        let finalization_state = {
            "state" : "stored",
            "OK" : "true",
            "ids" : ids
        }
        return finalization_state
    }
}


module.exports = GeneralTransitionEngImpl
