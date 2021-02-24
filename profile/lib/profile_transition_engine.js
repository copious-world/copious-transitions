const { GeneralTransitionEngine } = require.main.require('./lib/general_transition_engine')
const hexUtils = require.main.require('./lib/hex_utils')
const fs = require('fs')

//const EventEmitter = require('events')
//const cached = require('cached')
//
//const web_crypto = require('webcrypto')
//var g_crypto = web_crypto.crypto.subtle

const { Crypto } = require('node-webcrypto-ossl')
const { type } = require('os')
const crypto = new Crypto()
var g_crypto = crypto.subtle; //webcrypto.crypto.subtle


const FORCE_FAIL_FETCH = "NotAnObject"
const APP_STORAGE_CLASS = "PROFILE"



// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//
class ProfileTransitionEngineClass extends GeneralTransitionEngine {
    //
    constructor() {
        super()
    }
    //
    initialize(conf,db) {
        super.initialize(conf,db)
    }
    //
    async publish(topic,object) {
        if ( this.db === undefined ) return
        let pdb = this.db.pdb
        if ( pdb === undefined ) return
        let result = await pdb.publish(topic,object)
        if ( result ) {
            if ( result.state ) return(result.state)
            if ( typeof result === 'string' ) {
                return result
            }
            if ( typeof result.status === "string" ) return result
            if ( result !== false ) return "OK"
            return "ERR"
        }
    }
    //
    
    //
}


//
module.exports = new ProfileTransitionEngineClass()
