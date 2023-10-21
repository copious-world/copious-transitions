//
const crypto = require('crypto')



/**
 * Provides a default hash for the library.
 * `default_lib_hash` may be overridden by a configuration field:: `session_token_hasher`
 * 
 * @param {string} text 
 * @returns 
 */
function default_lib_hash(text) {
    const hash = crypto.createHash('sha256');
    hash.update(text);
    let ehash = hash.digest('base64url');
    return(ehash)
}


module.exports = default_lib_hash

