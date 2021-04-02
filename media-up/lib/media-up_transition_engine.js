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
        //
        this.init_ipfs()
    }

    //
    async init_ipfs() {
        this.node = await IPFS.create()
        const version = await this.node.version()
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

/*
var image = 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAA..kJggg==';

var data = image.replace(/^data:image\/\w+;base64,/, '');

fs.writeFile(fileName, data, {encoding: 'base64'}, function(err){
  //Finished
});





async function main () {
  const node = await IPFS.create()
  const version = await node.version()

  console.log('Version:', version.version)

  const fileAdded = await node.add({
    path: 'hello.txt',
    content: 'Hello World 101'
  })

  console.log('Added file:', fileAdded.path, fileAdded.cid)

  const chunks = []
  for await (const chunk of node.cat(fileAdded.cid)) {
      chunks.push(chunk)
  }

  console.log('Added file contents:', uint8ArrayConcat(chunks).toString())
}




*/

    //
    async file_mover(file_descriptor,target_path,cb) {
        let file_name = file_descriptor.name
        let file_data = file_descriptor.data          // assuming this to be a uint8Array

        //file_name = target_path + file_name
        console.log(file_name)
        file_data = this.store_encrypted(file_data)
        //
        const file = await this.node.add({
            path: file_name,
            content: file_data
        })

        let cid = file.cid.toString()

        console.log(`${__filename}::file_mover : ${cid}`)

        return file.cid.toString()
        //
    }

    //

    async store_data(file_descriptor,target_path,writeable_data,id) {
        let file_name = file_descriptor.name
        //
        console.log(file_name)
        let file_data = this.store_encrypted(writeable_data)
        //
        const file = await this.node.add({
            path: file_name,
            content: file_data
        })

        let cid = file.cid.toString()

        console.log(`${__filename}::file_mover : ${cid}`)
        return file.cid.toString()
        
    }

    //
}


//
module.exports = new UploaderTransitionEngineClass()
