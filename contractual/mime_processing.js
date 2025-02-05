
const LocalTObjectCache = require('../default_storage/local_object_cache')

/**
 * MimeHandling provides a collection of methods that serve an API made for retrieving assets
 * which have some mime type, usually related to data stored in a file. 
 * 
 * The methods access either the **static** or the **dynamic** data providers. Usually, these providers are understood as those
 * that provide static data, premaid and perhaps cached in memory, or they provide dynamically generated data (i.e. they use some 
 * processing power and time in order to generate the data to be transmitted on behalf of the request.)
 * 
 * The methods call out to the session handler for authorization for delivery. In some cases, the methods make use of token 
 * sequencing to build the case for releasing data to the requester. These types of delivery rely on the `fetcher` method
 * revealed by the static or dynamic provider. In the case of sequencing, provided data may be produced in a first step and then 
 * retrieved after some match condition (secret sharing) passes in a second step, where each step corresponds to a request.
 * 
 * Note: none of these methods handle streaming. Data is sent back to the requested in JSON object, where the useful part of the object
 * will be in a string or sub-object.
 * 
 * The methods return a status code as part of the tupple returned. These codes are HTTP status codes.
 * 
 * @memberof Contractual
 */
class MimeHandling extends LocalTObjectCache {
    //
    //
    constructor(sess_manager,validator,statics,dynamics,cache_time) {
        //
        super(cache_time)

        this.going_ws_session = {}
        //
        this.session_manager = sess_manager
        this.validator = validator
        this.statics = statics
        this.dynamics = dynamics
    }

    /**
     * This method sends the request body into session manager's `guard_static` to check access.
     * Then, if access is allowed, this method calls upon the statics module to get the object.
     * 
     * The statics module returns an object that should mention the mime type of the data along with the data.
     * The object returned must have two fields:
     * * `mime_type` - the kind of media being returned
     * * `string` - the media being returned in string format
     * 
     * The application must understand the relationship between the client and the server in how data delivered as a string should be
     * processed for use.
     * 
     * @param {string} asset - an identifier of the asset requested
     * @param {object} body - data relating to the user session and other data useful in finding the asset and establishing access
     * @param {object} transmision_headers 
     * @returns {Array} - a tupple really, that has: 1) the status code, 2) the JSON response, 3) possibly data or boolean (false for not in use)
     */
    async static_asset_handler(asset,body,transmision_headers) {
        let proceed = await this.session_manager.guard_static(asset,body,transmision_headers)
        if ( proceed ) {     // returns a true value by default, but may guard some assets
            var asset_obj = await this.statics.fetch(asset,body);     // returns an object with fields mime_type, and string e.g. text/html with uriEncoded html
            if ( typeof asset_obj !== 'object' || asset_obj.mime_type == undefined ) {
                let hypothetical = asset_obj
                asset_obj = {}
                asset_obj.mime_type = "text/html"
                try {
                    asset_obj.string = hypothetical.toString()
                } catch(e) {
                    try {
                        asset_obj.string = JSON.stringify(hypothetical)
                    } catch(e) {
                        asset_obj.string = "could not convert"
                    }
                }
            }
            return [200,{ 'Content-Type': asset_obj.mime_type },asset_obj.string]
        } else {
            return [200,{ 'type' : 'user', 'OK' : 'false', 'reason' : 'unavailable' }, false]
        }
    }


    /**
     * This method provide the same logic for both dynamic and static data.
     * The only difference between a request for dynamic and static data, is that the fetcher method is on the static or dynamic instance.
     * So, this method takes the *fetcher* as a paremeter. 
     * 
     * For both dynamic and static mime data, the session managers' guard is called. And, if the request passes the guard, 
     * then the asset can be processed in the sense that a token object will be made for it by the session manager.
     * The transition object will specify whether or not the mime data will be cached and sent after a seconday transaction or if it will be 
     * sent right away.
     * 
     * If the secondary action is used, the transition object components that are to be used by the requester (client) are sent along with the 
     * repsonse object.
     * 
     * @param {string} asset 
     * @param {object} body 
     * @param {object} transmision_headers 
     * @param {Function} fetcher 
     * @returns {Array} - a tupple really, that has: 1) the status code, 2) the JSON response, 3) possibly data or boolean (false for not in use)
     */
    async guarded_kindof_asset_handler(asset,body,transmision_headers,fetcher) {
        //
        let proceed = await this.session_manager.guard(asset,body,transmision_headers)
        if ( proceed ) {             // asset exits, permission granted, etc.
            let transitionObj = await this.session_manager.process_asset(asset,body)  // not checking sesssion, key the asset and use any search refinement in the body.
            if ( transitionObj ) {
                if ( transitionObj.secondary_action ) {                          // return a transition object to go to the client. 
                    try {
                        let asset_obj = await fetcher(asset,transitionObj);                     // get the asset for later
                        let tObjCached = { 'tobj' : transitionObj, 'asset' : asset_obj } 
                        this.add_local_cache_transition(transitionObj.token,tObjCached)
                        return [200,{ 'type' : 'user', 'OK' : 'true', 'data' : transitionObj },true]    
                    } catch (e) {
                        console.log(e)
                        // allow report of unavailable
                    }
                } else {
                    let asset_obj = await fetcher(asset,transitionObj);     // no checks being done, just send the asset. No token field included
                    if ( (asset_obj !== false)  && ( asset_obj.mime_type !== undefined )) {
                        return [200,{ 'Content-Type': asset_obj.mime_type },asset_obj.string]
                    }
                }
            }
        }
        return [200,{ 'type' : 'user', 'OK' : 'false', 'reason' : 'unavailable' },false ]
        //
    }

    /**
     * This method calls the method `guarded_kindof_asset_handler` with the reference to the GeneralStatic instance 
     * in the member variable `statics`. 
     * 
     * @param {string} asset 
     * @param {object} body 
     * @param {object} transmision_headers 
     * @returns {Array} - a tupple really, that has: 1) the status code, 2) the JSON response, 3) possibly data or boolean (false for not in use)
     */
    async guarded_static_asset_handler(asset,body,transmision_headers) {
        let fetcher = this.statics.fetch
        return await this.guarded_kindof_asset_handler(asset,body,transmision_headers,fetcher)
    }


    /**
     * 
     * This method calls the method `guarded_kindof_asset_handler` with the reference to the GeneralDynamic instance 
     * in the member variable `dynamics`. 
     * 
     * @param {string} asset 
     * @param {object} body 
     * @param {object} transmision_headers 
     * @returns {Array} - a tupple really, that has: 1) the status code, 2) the JSON response, 3) possibly data or boolean (false for not in use)
     */
    async guarded_dynamic_asset_handler(asset,body,transmision_headers) {
        let fetcher = this.dynamics.fetch
        return await this.guarded_kindof_asset_handler(asset,body,transmision_headers,fetcher)
    }

    /**
     * When the transition object returned from the session manager's `process_asset` method requires the `secondary_action`,
     * it sets up the transition object in cache with the anticipation that this method will be called in response to 
     * another request from the client tied to the current session and the transition token set on the transition object by `process_asset`.
     * 
     * This method will only operation if the request's body object has a recognizable token field. 
     * Given the token, the cached transition object can be retrieved from the cache. Once it is in hand, 
     * the data from the body object and the cached can transtion are passed to the application's matching methods to
     * see if the body data passed tests allowing the request to gain access to previously produced data. 
     * 
     * For the mime type handlers, `key_mime_type_transition` can be used to see if the requested mime type is supported by the application.
     * 
     * Given the tests pass, the `data` field of the cached transition is accessed to get the data that will be provided to the requesting client.
     * 
     * @param {object} body 
     * @returns {Array} - a tupple really, that has: 1) the status code, 2) the JSON response, 3) possibly data or boolean (false for not in use)
     */
    async guarded_secondary_asset_handler(body) {
        //
        if ( body.token !== undefined ) {
            let cached_transition = this.fetch_local_cache_transition(body.token)
            if ( cached_transition !== undefined ) {
                if ( this.session_manager.match(body,cached_transition)  ) {                // check on matching tokens and possibly other things
                    if ( this.session_manager.key_mime_type_transition(req) ) {
                        let asset_obj = cached_transition.data                          // Finally, send the asset 
                        if ( (asset_obj !== false)  && ( asset_obj.mime_type !== undefined )) {
                            return [200,{ 'Content-Type': asset_obj.mime_type },asset_obj.string]   // returns the header component and data
                        }
                    }
                }
            }
        }
        return [200,{ 'type' : 'user', 'OK' : 'false', 'reason' : 'unavailable' }, false]
        //
    }



}





module.exports = MimeHandling