const { Crypto } = require('web-crypto')
let fs = require('fs')

const crypto = new Crypto()
var g_crypto = crypto.subtle; //webcrypto.crypto.subtle

async function do_key_gen() {
    let key = await g_crypto.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 4096, //can be 1024, 2048, or 4096
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: { name: "SHA-256" }, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
        },
        true,
        ["wrapKey","unwrapKey"]
    )
    let private_key = key.privateKey
    let public_key = key.publicKey

    let priv_jwk = await g_crypto.exportKey('jwk',private_key)
    let public_jwk = await g_crypto.exportKey('jwk',public_key)

    console.log(priv_jwk)
    console.log(public_jwk)

    let priv_jwk_str = JSON.stringify(priv_jwk)
    let public_jwk_str = JSON.stringify(public_jwk)
    fs.writeFileSync("./local/audio_keys_jwk_nr.json",priv_jwk_str)
    fs.writeFileSync("./local/audio_keys_public_jwk_str.json",public_jwk_str)

}


do_key_gen()
