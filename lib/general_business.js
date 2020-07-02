const AppLifeCycle = require("./general_lifecyle")
const fs = require('fs')

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
        try {
            this.logo_body = fs.readFileSync(conf_obj.html_wrapper_with_logo,"utf-8").toString()
        } catch (e) {
            // this.logo_body = require("vanilla").load()
        }
        
    }

    //
    process(use_case,post_body) {
    }

    store_recent_forgetfulness(email,trackable) {
        this.recently_forgetful[email] = trackable
    }
}


module.exports = GeneralBusiness

