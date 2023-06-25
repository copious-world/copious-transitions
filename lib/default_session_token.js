

const uuid = require('./uuid')




/**
 * @callback token_lambda
 * @param {string} [prefix] - optionally prefix the token whith an application specfic string
 * @returns {string} -- a unique identifier relative to the running application scope (defind by the application)
 */


function default_token_maker(prefix) {
    let suuid = '' + uuid()
    let token = (prefix ? prefix : '') + suuid
    return token
}


/**
 * A local manager of session and their state transition tokens.
 * 
 * 
 * The session should always be recoverable from a token specifically designed for keying the state transions of the session.
 * Other transition tokens should also identify the session, but will have no key into session state transitions, 
 * instead they will key into the state transitions of media, stream, or processes. 
 *
 * Tokens can be lent by a proactive lender for the lifetime of the owner session (requires reference count)
 * Tokens can be given by a proactive seller/giver in order to hand off state transitions to a seconday micro service
 *
 */

class LocalSessionTokens {

   /**
    * @constructor
    * @param {Object} db_obj - A database reference which supports get, set, del for ephemeral and long timed LRU.
    * @param {token_lambda} [token_creator] - A method for making a token which will be used as a unique key into the database.
    */
    constructor(db_obj,token_creator) {
        this.db = db_obj
        this.goingSessions = {};        // map to owner
        this.goingTokens = {};          // map to owner -- token belongs to owner (ucwid)
        this.token_to_session = {};     // token belons to session
        this._token_creator = token_creator ? token_creator : default_token_maker
    }


   /**
    * Fetch the ownership key belonging to a token
    * @param {string} token - An ephemeral token for transitions sequences.
    * @returns {string} - the ownership key of the token e.g. a ucwid
    */
   from_token(token) {
        let key = this.goingTokens[token]
        return key
    }

    /**
     *  Calls upon the instance lambda in order to create a token for whatever use is intended.
     * @param {string} [prefix] - optionally put prefix the token whith an applicatino specfic string
     * @returns {string} -- a unique identifier relative to the running application scope (defind by the application)
     */
    create_token(prefix) {
        return this._token_creator(prefix)
    }

    /**
     * Given a session_token, adds it to the local tables plus the session database. Stores the database hash in maps indexed by
     * the session_token and by the ownership_key.
     * @param {string} session_token - a token identifiying a session typically returned by a login process
     * @param {string} ownership_key - a string representation of an ownership ID such as a did.
     */
    async add(session_token,ownership_key) {
        // src_key e.g. augmented hash token  OR hh unidentified (an intermediate hash)
        let src_key = await this.db.set_session_key_value(session_token,ownership_key)
        this.goingSessions[ownership_key] = session_token
        this.goingTokens[session_token] = ownership_key
    }

 
    /**
     *  Removes a sessions from the general discourse of all micro services given the state transition token that that keys the session
     *  @param {string} token - a token that keys the state transitions of a session and can map to the session
     */
    destroy_session(token) {
        let src_key = this.goingTokens[token];
        if ( src_key != undefined ) {
            try {
                delete this.goingSessions[src_key]
                delete this.goingTokens[token]
                this.db.del_session_key_value(token)
            } catch (e) {
                //
            }
        }
    }

    /**
     * Returns the ownsership key associated with either a session token or a session id.
     * @param {string} token - a token that keys the state transitions of a session and can map to the session
     * @param {boolean} is_sess_req - select the type of token being passed
     */
    async current_active(token,is_sess_req) {
        let key = this.goingTokens[token]  // local not shared ... session may be going and recorded in shared stored but not yet here
        if ( (key !== undefined) ) {
            return key
        } else {
            try {
                if ( is_sess_req ) {
                    key = await this.db.get_session_key_value(token)
                } else {
                    key = await this.db.get_key_value(token)
                    if ( key == null || (key === false) ) {
                        return (false)
                    } else {
                        this.goingTokens[token] = key;
                        return (key)
                    }
                }
            } catch (e) {
                return (false)
            }
        }
    }
 



/*
addToken(value,token) {
    if ( (value !== undefined) && (token !== undefined) ) {
        this.db.set_key_value(token,value)
        this.goingTokens[token] = value
    }
}

destroyToken(token) {
    let src_key = this.goingTokens[token];
    if ( src_key != undefined ) {
        try {
            delete this.goingTokens[token]
            this.db.del_key_value(token)
        } catch (e) {
            //
        }
    }
}
*/

}



module.exports.LocalSessionTokens = LocalSessionTokens
