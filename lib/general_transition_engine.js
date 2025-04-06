
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

        this.file_pr = fs_pr
        this._repo = false
    }


    /**
     * set_file_promise_ops
     * 
     * can be `extra-file-class` for instance...
     * 
     * @param {Object} f_pr_ops -- an instance of class providing file promises as an extension of fs/promises
     */
    set_file_promise_ops(f_pr_ops) {
        this.file_pr = f_pr_ops
    }

    /**
     * add_repo_path
     * 
     * This method is called by the general link manager when installing a new repository link,
     * which will mostly likey be an instance of CategoricalPersistenceManager from global_persistence
     * 
     */
    async add_repo_path(repo_instance) {
        if ( this._repo ) {
            // could conceivably change the global category definition.. but not likely...
            return
        }
        this._repo = repo_instance
    }

    /**
     * At this level, this method just sets the configuration and the database referenc.
     * @param {object} conf 
     * @param {object} db 
     */
    initialize(conf,db) {
        this.conf = conf
        this.db = db
    }


    /**
     * seeking_endpoint_paths  
     * 
     * Included for special cases
     * @returns Array
     */
    seeking_endpoint_paths() {
        return []
    }

    /**
     * set_messenger
     * 
     * @param {string} path 
     * @param {object} messenger -- communication object
     */
    set_messenger(path,messenger) {
    }



    /**
     * This method sets back references to other lib component class instances.
     * It also tends to the importation of crypto keys.
     * 
     * @param {object} `statics_assets` 
     * @param {object} `dynamics_assets` 
     * @param {object} sessions 
     */
    install(statics_assets,dynamics_assets,sessions) {
        this.sessions = sessions
        this.statics = statics_assets
        this.dynamics = dynamics_assets
        this.statics.set_transition_engine(this)
        this.dynamics.set_transition_engine(this)
        //
        dynamics_assets.import_keys(this.get_import_key_function())
    }


    /**
     * This method sets back references to the contractual methods which provide the skeletal outline 
     * for handling client requests. The contractual class methods, especially those for transition processing,
     * are generally the callers of the application's transition engine. But, the transition engine may call 
     * back to those classes if needed (depends on the application).
     * 
     * 
     * @param {object} `trans_processor` 
     * @param {object} `user_processor` 
     * @param {object} `mime_processor` 
     */
    set_contractual_filters(trans_processor,user_processor,mime_processor) {
        this.trans_processor = trans_processor
        this.user_processor = user_processor
        this.mime_processor = mime_processor
    }



    /**
     * Accepts a reference to the application supplied web socket server manager and sets the `web_sockets` field to it.
     * 
     * At times, the transition engine will use the web socket service to fire off messages to listening clients.
     * 
     * @param {object} `web_sockets` - the reference to the application supplied web socket server manager.
     */
    set_ws(web_sockets) {
        this.web_sockets = web_sockets
    }


    /**
     * This method returns false. It should be overridden in applications using crytpo key processing.
     * 
     * @returns {string|boolean}
     */
    get_import_key_function() {
        return(false)
    }

    /**
     * Calls the node.js Buffer.concat method. Some application may do something else.
     * Returns a buffer.
     * 
     * @param {Buffer} `blob_data` 
     * @returns {Buffer}
     */
    chunks_to_data(blob_data) {
        return Buffer.concat(blob_data)
    }


    /**
     * A number of parameters are provided for applications needing more complexity than this method provides.
     * 
     * As a default, this method calls node.js `mv`.
     * 
     * @param {object} `file_descriptor` 
     * @param {string} `target_path` 
     * @param {object} `trans_obj` 
     * @param {Function} cb 
     * @returns {Number}
     */
    async file_mover(file_descriptor,target_path,trans_obj,cb) {
        if ( cb ) {
            await file_descriptor.mv(target_path,cb)
        } else {
            await file_descriptor.mv(target_path)
        }
        return(Math.floor(Math.random()*10000)) // default random int
    }

    /**
     * By default, this method calls the async writeFile method to store data.
     * Some applications may need to route storage at this point.
     * 
     * @param {object} `file_descriptor` 
     * @param {string} `target_path` 
     * @param {string} `writeable_data` 
     * @param {string} id 
     * @returns {string}
     */
    async store_data(file_descriptor,target_path,writeable_data,id) {
        if ( file_descriptor ) {
            await file_descriptor.writeFile(target_path,writeable_data)
        } else {
            await this.file_pr.writeFile(target_path,writeable_data)
        }
        return id
    }

    /**
     * This method is provided for those applications using persistent storage use meta descriptors of files.
     * 
     * @param {object} `post_body` 
     * @param {Array} ids 
     */
    async update_meta_descriptors(post_body,ids) {}

    /**
     * Returns true if the application override is configured to use alternate storage to the default storage provided here.
     * 
     * @returns {boolean}
     */
    alt_store() { return false }

    /**
     * Replaces the functionality of `store_data` if alt_store returns true.
     * 
     * In the application version of this method, the point is to return data that can be written into a 
     * file using the method `store_data`.
     * 
     * @param {object} blob_data 
     */
    app_pack_data(blob_data) {}


    // chunk_mover
    // per file chunk mover
    /**
     * 
     * The map `_uploader_managers` stores a chunk manager per transition token.
     * Elsewhere in this documentation, the transition object and its token is explained.
     * One kind of transition is one that takes in data from the client, and its token 
     * will last as long as the data is being uploaded.
     * 
     * The chunk manager has the purpose of return a collection of chunks in preparation for writing to storage.
     * In some applications, the `chunk_mover` may return **false** if the chunks cannot be a complete file. 
     * The expectation is that the chunk mover will be called again after adding more chunks, until the data can be stored 
     * as a complete object.
     * 
     * When the storage operation has been performed, the `store_data` method will return an identifier that identifies the data.
     * This may be a hash of the data. Ultimately, this identifier will be returned by this method.
     * 
     * This method is called by `chunks_complete`.
     * 
     * @param {string} `token` 
     * @param {object} `file_descriptor` 
     * @param {string} `target_path` 
     * @param {Function} `cb` 
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
     * Initializes a chunk manager that will receive a number of files identified in the requet body of an uploader type
     * of transition. The chunk manager will be keyed (remembered) by its transition token.
     * 
     * The post body should have a field `file_list` which must be an array of file descriptors.
     * Each descriptor will have at least one field `name`. The chunk manager will have a map, `_chunkers`, 
     * which maps the file name to an empty array. The empty array will later be filled with chunk data.
     * 
     * If the post body does not have a `file_list` field, the chunk manager will keep just one array where all the chunks
     * being uploaded will be placed for future storage in just one file.
     * 
     * This method is often called by the application's session manager as a part of transition processing. 
     * 
     * @param {object} `post_body` - the POST request body from the client (or a message from the endpoint server)
     * @param {string} `token` - the chunk manager is always identified by the transtion token
     */
    files_coming_in_chunks(post_body,token) {
        let chunk_manager = Object.assign({},post_body)
        if ( post_body.file_list ) {            // MULTIPLE FILES. for clients sending more than one file, a list is expected beyond the typical form field list
            chunk_manager._chunkers = {}
            for ( let file of post_body.file_list ) {   // EACH of file list
                if ( file.name !== undefined ) {
                    chunk_manager._chunkers[file.name] = []   // chunks  // each file in the list has to have at least a name
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
     * This method takes in the client's POST request body (or endpoint message) and the list of files associated with it.
     * In some applications, the *files* map may be part of the request body. In other applications, the *files* map may be associated with a
     * session token or session and might be cached between calls to the `upload_chunk`.
     * 
     * The post body must have the `token` field with the value being the transition token required by the request.
     * 
     * The previously prepared chunk manager will be accessed by mapping the token to the chunk manager in the 
     * `_uploader_managers` map.
     * 
     * The files parameter must alwasy be a map even if there is only one file in `files`. 
     * If there is just one file, this method will check to see if uploading has been prepared to manage just one file. 
     * If it has been prepared to upload more, it is possible to have just one file if it is the last file still gathering chunks
     * from the client. Complete files may have already been finalized. (This is why there are differen field names for the single
     * and multiple case.)
     * 
     * This method is often called by the application's session manager as a part of secondary transition processing.
     * 
     * 
     * @param {object} `post_body` 
     * @param {string} `files` 
     * @returns {object} - `state_of_result` 
     */
    async upload_chunk(post_body,files) {
        if ( !files || Object.keys(files).length === 0) {
            let state_of_result = {
                "state" : "failed",
                "OK" : false
            }
            return state_of_result
        }
        //
        let token = post_body.token
        let f_keys =  Object.keys(files)
        let chunk_manager = this._uploader_managers[token]
        if ( (f_keys.length === 1) && chunk_manager._chunks ) {         // Handling one file
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
        let state_of_result = {
            "state" : "next",
            "OK" : true
        }
        return state_of_result
    }


    /**
     * 
     * The post body must have the `token` field with the value being the transition token required by the request.
     * 
     * The previously prepared chunk manager will be accessed by mapping the token to the chunk manager in the 
     * `_uploader_managers` map.
     * 
     *  The post body must have one of the following fields:
     * 
     * * `file_list` - an array of file descriptors
     * * `file` - a single descriptor
     * 
     * If the post body has the field `file_list`,which must be an array of file descriptors,
     * then each descriptor will have at least one field `name`. The chunk manager will have a map, `_chunkers`, 
     * which maps the file name to the array of gathered chunks.
     * 
     * If the post body  as a `file` field instead of a `file_list` field, the chunk manager will look for the one array 
     * where all the chunks being uploaded have been gathered for storage in just one file.
     * 
     * This method attempts to create a unique name for the file from the information that has been passed to it. 
     * Furthermore, it makes use of the transition class object's `file_entry_id`.
     * 
     * This method is often called by the application's session manager as a part of transition finalization. 
     * 
     * @param {object} post_body 
     * @param {object} ttrans - the transition class object
     * @returns {object} - `finalization_state` - this object has fields "state" equal to "stored" if successful, "OK" equal to **true**,
     * and a list of ids, which are all the file ids that have been finally stored.
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
     * This method servers to upload a single file or multiple files in response one request, where 
     * all the files are complete upon arrival. (If chunking has occurred, it has been handled by standard HTTP mechanisms).
     * 
     * The function of this handler is fairly common code stacks. Other methods in the class are useful in situations 
     * where data undergoes intermediate treatment during data gathering or when data is coming in messages from the endpoint server.
     * Usually, this method is used when uploading a file from disk and passing it through standard forms. 
     * 
     * This method augments the placement of the file into an application directory by adding descriptors of the file into the DB 
     * (which is again defined by the application).
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
