//const fs =  require('fs')
//const { promisify } = require("util");
const AppLifeCycle = require("./general_lifecyle")
//const crypto = require('crypto')


class GeneralTransitionEngImpl extends AppLifeCycle {
    //
    constructor() {
        super()
        this.db = null
        this.statics = null
        this.dynamics = null
    }

    initialize(conf,db) {
        this.conf = conf
        this.db = db
    }

    install(statics_assetis,dynamics_assets) {
        this.statics = statics_assetis
        this.dynamics = dynamics_assets
        this.statics.set_transition_engine(this)
        this.dynamics.set_transition_engine(this)
        dynamics_assets.import_keys(this.get_import_key_function())
    }

    get_import_key_function() {
        return(false)
    }

}


exports.GeneralTransitionEngine = GeneralTransitionEngImpl
