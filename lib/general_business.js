const AppLifeCycle = require("lib/general_lifecyle")

class GeneralBusiness extends AppLifeCycle {
    
    constructor(conf) {
    }

    //
    initialize(conf_obj,db) {
        this.db = db
        this.rules = conf_obj.business ? ( conf_obj.business.rules ? conf_obj.business.rules : null ) : null
    }

    process(use_case,post_body) {
    }
}


module.exports = GeneralBusiness

