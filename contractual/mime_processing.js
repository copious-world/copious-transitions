


const LocalTObjectCache = require('../custom_storage/local_object_cache')


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

    async static_asset_handler(asset,body,transmision_headers) {
        let proceed = await this.session_manager.guard_static(asset,body,transmision_headers)
        if ( proceed ) {     // returns a true value by default, but may guard some assets
            var asset_obj = await this.statics.fetch(asset);     // returns an object with fields mime_type, and string e.g. text/html with uriEncoded html
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
            return [200,{ 'type' : 'user', 'OK' : 'false', 'reason' : 'unavailable' },false ]
        }
    }


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

    async guarded_static_asset_handler(asset,body,transmision_headers) {
        let fetcher = this.statics.fetch
        return await this.guarded_kindof_asset_handler(asset,body,transmision_headers,fetcher)
    }


    async guarded_dynamic_asset_handler(asset,body,transmision_headers) {
        let fetcher = this.dynamics.fetch
        return await this.guarded_kindof_asset_handler(asset,body,transmision_headers,fetcher)
    }

    async guarded_secondary_asset_handler(body) {
        //
        if ( body.token !== undefined ) {
            let cached_transition = this.fetch_local_cache_transition(body.token)
            if ( cached_transition !== undefined ) {
                if ( this.session_manager.match(body,cached_transition)  ) {                // check on matching tokens and possibly other things
                    if ( this.session_manager.key_mime_type_transition(req) ) {
                        let asset_obj = cached_transition.data                          // Finally, send the asset 
                        if ( (asset_obj !== false)  && ( asset_obj.mime_type !== undefined )) {
                            return [200,{ 'Content-Type': asset_obj.mime_type },asset_obj.string]
                        }
                    }
                }
            }
        }
        return [200,{ 'type' : 'user', 'OK' : 'false', 'reason' : 'unavailable' },false ]
        //
    }



}





module.exports = MimeHandling