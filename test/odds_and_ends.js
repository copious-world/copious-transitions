const uuid = require('uuid/v4')
const crypto = require('crypto')

for ( let i = 0; i < 100; i++ ) {
    let s = uuid()
    console.log(`${s.length} :: ${s}`)
}




do_hash = (text) => {
    const hash = crypto.createHash('sha256');
    hash.update(text);
    let ehash = hash.digest('hex');
    return(ehash)
}


for ( let i = 0; i < 100; i++ ) {
    let s = uuid()
    let h = do_hash(s)
    console.log(`${h.length} :: ${h}`)
}



