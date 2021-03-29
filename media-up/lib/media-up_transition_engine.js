const { GeneralTransitionEngine } = require.main.require('./lib/general_transition_engine')
const hexUtils = require.main.require('./lib/hex_utils')
const fs = require('fs')
const uuid = require('uuid/v4')

//const EventEmitter = require('events')
//const cached = require('cached')
//
//const web_crypto = require('webcrypto')
//var g_crypto = web_crypto.crypto.subtle

const { Crypto } = require('node-webcrypto-ossl')
const { type } = require('os')
const crypto = new Crypto()
var g_crypto = crypto.subtle; //webcrypto.crypto.subtle


const IPFS = require('ipfs')            // using the IPFS protocol to store data via the local gateway


const FORCE_FAIL_FETCH = "NotAnObject"
const APP_STORAGE_CLASS = "DASHBOARD"



// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//
class UploaderTransitionEngineClass extends GeneralTransitionEngine {
    //
    constructor() {
        super()
        
        this.node = await IPFS.create()
        const version = await node.version()
        console.log('Version:', version.version)
    }

    //
    initialize(conf,db) {
        super.initialize(conf,db)
    }

    //
    store_encrypted(file_data) {
        return file_data
    }

    //
    async file_mover(file_descriptor,target_path,cb) {
        let file_name = file_descriptor.file_name
        let file_data = file_descriptor.buffer          // assuming this to be a uint8Array

        file_name = target_path + file_name
        file_data = this.store_encrypted(file_data)
        //
        const file = await node.add({
            path: file_name,
            content: file_data
        })

        return file.cid.toString()
        //
    }

    //
}


//
module.exports = new UploaderTransitionEngineClass()