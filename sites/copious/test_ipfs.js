const fs = require('fs')
const uuid = require('uuid/v4')
const os = require('os')

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


async function init_ipfs() {
    let node = await IPFS.create({
        repo: __dirname + '/.jsipfs2',
        config: {
          Addresses: {
            Swarm: [
              '/ip4/0.0.0.0/tcp/4012',
              '/ip4/127.0.0.1/tcp/4013/ws'
            ],
            API: '/ip4/127.0.0.1/tcp/5012',
            Gateway: '/ip4/127.0.0.1/tcp/9191'
          }
        }
      })
    const version = await node.version()
    console.log('Version:', version.version)


    let cid = 'QmdBKa2m1PxZRcnSGizQdwRyp21pKhXTkHjVgdAb6YhmRh'
    const chunks = []
    for await ( const chunk of node.cat(cid) ) {
        chunks.push(chunk)
    }
  
    console.log(chunks.length)
    let output = Buffer.concat(chunks)

    fs.writeFileSync("test.mp3",output)
}


init_ipfs()
