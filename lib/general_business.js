const AppLifeCycle = require("./general_lifecyle")
const fs = require('fs')



/** 
 * This module provides a stand-in for applications that will perform some business processing 
 * one transitions have fulfilled.
 * 
 * Interesting implementations have been moved out of the library and into applications. 
 * Some actions such as email responses previously program are becoming archaic.
 * But, some applications may still use them.
 * 
 * In any case, the reference to the applications Business class instance is available to a number of other clases, 
 * among them, the application's session manager. The application's session manager is the only CopiousTranstions governed library class
 * to be initialized with the Business class as a parameter. But the session manager might pass this on to the transition engine or 
 * to the DB manager in some applications. (Again, it is up to the application to use or ignore this class.)
 * 
 * NOTE: all the base classes in /lib return the class and do not return an instance. Explore the applications and 
 * the reader will find that the descendant modules export instances. The classes provided by copious-transitions must
 * be extended by an application.
 * 
 * @memberof base
 */

class GeneralBusiness extends AppLifeCycle {
    
    constructor() {
        super()
        //
        this.recently_forgetful = {}
        this.forgetfulness_tag = ""
        this.logo_body = ""
        this.mail_transport = null
        this.messenger = false
    }


    seeking_endpoint_paths() {
        return [ "mail" ]
    }

    set_messenger(path,messenger) {
        if ( path === 'mail' ) {
            this.messenger = messenger
        }
    }


    //
    /**
     * initialize
     * 
     * @param {object} conf_obj 
     * @param {object} db 
     */
    initialize(conf_obj,db) {
        this.db = db
        this.class_conf = conf_obj.business
        if ( typeof this.class_conf === "object" ) {
            this.rules = this.class_conf.rules ? this.class_conf.rules : false 
            this.forgetfulness_tag = this.class_conf.forgetfulness_tag ? this.class_conf.forgetfulness_tag : ""
            this.root_path = process.cwd()
            try {
                this.logo_body = fs.readFileSync(this.root_path + '/' + this.class_conf.html_wrapper_with_logo,"utf-8").toString()
            } catch (e) {
                // this.logo_body = require("vanilla").load()
            }    
        }
        
    }

    //
    /**
     * For definition by an application.
     * 
     * If a application's session manager calls for the initiation of some business process, identified by `use_case`,
     * this method can be called. This method is left empty for definition in an applications's subclass. 
     * 
     * And example might be that email is sent to someone once a transition if finalized.
     * 
     * @param {string} use_case - a flag for a switch statement or a map key to a function. 
     * @param {object} post_body - The post body is from the client request.
     */
    process(use_case,post_body) {
    }

    /**
     * Some applications may support forgotten passwords as part of authorization.
     * This interface provides applications with some methods to start tracking exchanges 
     * with users having to do with reseting passwords or other activities related to forgotten authorization memes.
     * 
     * This method makes an entry for the forgotten item.
     * 
     * @param {string} pkey 
     * @param {object} trackable 
     */
    store_recent_forgetfulness(pkey,trackable) {
        this.recently_forgetful[pkey] = trackable
    }

    /**
     * Retrieve information related to the forgotten password activity.
     * 
     * @param {string} pkey 
     * @returns {object}
     */
    get_recently_forgetful(pkey) {
        return(this.recently_forgetful[pkey])
    }

    /**
     * Delete information related to the forgotten password activity.
     * 
     * @param {string} pkey 
     */
    del_recent_forgetfulness(pkey) {
        delete this.recently_forgetful[pkey]
    }

    /**
     * Related to the forgotten information. Provides a call frame that relates the 
     * forgotten information to a transition. And allows for some application defined process 
     * that uses information from the request's body.
     * 
     * @param {string} transition 
     * @param {string} pkey 
     * @param {object} post_body 
     */
    cleanup(transition,pkey,post_body) {
        this.del_recent_forgetfulness(pkey)
    }
}



module.exports = GeneralBusiness

