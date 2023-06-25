const AppLifeCycle = require("./general_lifecyle")
const fs = require('fs')



/** 
 * This module provides a stand-in for applications that will perform some business processing 
 * one transitions have fulfilled
 */

class GeneralBusiness extends AppLifeCycle {
    
    constructor() {
        super()
        //
        this.recently_forgetful = {}
        this.forgetfulness_tag = ""
        this.logo_body = ""
    }

    //
    initialize(conf_obj,db) {
        this.db = db
        this.rules = conf_obj.business ? ( conf_obj.business.rules ? conf_obj.business.rules : null ) : null
        this.forgetfulness_tag = conf_obj ? ( conf_obj.forgetfulness_tag ? conf_obj.forgetfulness_tag : "" ) : ""
        this.root_path = process.mainModule.path
        try {
            this.logo_body = fs.readFileSync(this.root_path + '/' + conf_obj.html_wrapper_with_logo,"utf-8").toString()
        } catch (e) {
            // this.logo_body = require("vanilla").load()
        }
        
    }

    //
    process(use_case,post_body) {
    }

    store_recent_forgetfulness(pkey,trackable) {
        this.recently_forgetful[pkey] = trackable
    }

    get_recently_forgetful(pkey) {
        return(this.recently_forgetful[pkey])
    }

    del_recent_forgetfulness(pkey) {
        delete this.recently_forgetful[pkey]
    }

    cleanup(transition,pkey,post_body) {
        this.del_recent_forgetfulness(pkey)
    }
}



module.exports = GeneralBusiness

