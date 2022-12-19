//
const LocalTObjectCache = require('../custom_storage/local_object_cache')


class TransitionHandling extends LocalTObjectCache {
    //
    //
    constructor(sess_manager,validator,dynamics,cache_time) {
        //
        super(cache_time)

        this.going_ws_session = {}
        //
        this.session_manager = sess_manager
        this.validator = validator
        this.dynamics = dynamics
    }

    async transition_handler(transition,body,transmision_headers) {

        let proceed = await this.session_manager.guard(transition,body,transmision_headers)
        if ( !proceed ) {             // asset exits, permission granted, etc.  (check fail)
            return [200,{ 'type' : 'transition', 'OK' : 'false', 'reason' : 'unavailable' },false ]
        }
            //
        if ( this.validator.valid(body,this.validator.field_set[transition]) ) {         // A field set may be in the configuration for named transitions - true by default
            let is_feasible = await this.session_manager.feasible(transition,body,transmision_headers)
            // can this session actually make the transition?
            if ( is_feasible  ) {  
                //
                let transitionObj = await this.session_manager.process_transition(transition,body,transmision_headers)            // either fetch or produced transition data
                if ( transitionObj ) {
                    //
                    // Require a seconday action as part of the transition for finalization
                    if ( transitionObj.secondary_action ) {
                        // elements is purposely vague and may be application sepecific
                        try {
                            let [send_elements, store_elements] = await this.dynamics.fetch_elements(transition,transitionObj);
                            //
                            let tObjCached = { 'tobj' : transitionObj, 'elements' : store_elements, 'transition' : transition }
                            this.add_local_cache_transition(transitionObj.token,tObjCached)
                            //
                            let t_state = { 'type' : 'transition', 'OK' : 'true', 'transition' : transitionObj, 'elements' : send_elements }
                            return [200,t_state]    
                        } catch(e) {
                            console.log(e)
                            // nothing really... just report that you can't
                        }
                    } else {
                        // Send back a finalization of transition right away.
                        body.token = transitionObj.token
                        // FINALIZE (not a final state) -- means that the state finally makes the transition
                        let finalization_state = await this.session_manager.finalize_transition(transition,body,{},transmision_headers)
                        if ( finalization_state ) {     // relay the finalized transition and go on with business. 
                            let state = finalization_state.state
                            let OK = finalization_state.OK
                            let t_state = { 'type' : 'finalize', 'OK' : OK, 'state' : state, 'reason' : 'matched' }
                            return [200,t_state]
                        }
                    }
                    //
                }
                //
            }
        }
        return [200,{ 'type' : 'transition', 'OK' : 'false', 'reason' : 'unavailable' }]
    }


    async secondary_transition_handler(body,transmision_headers) {
        if ( body.token !== undefined ) {
            let cached_transition = this.fetch_local_cache_transition(body.token,body.next)
            if ( cached_transition !== undefined ) {
                if ( this.session_manager.match(body,cached_transition)  ) {        // check on matching tokens and possibly other things 
                    // some kind of transition takes place and becomes the state of the session. It may not be the same as the one
                    // specified in the cached transition, but may be similar depending on how types (categories) are regulated 
                    let elements = cached_transition.elements
                    let finalization_state = await this.session_manager.finalize_transition(cached_transition.transition,body,elements,transmision_headers)      // FINALIZE (not a final state)
                    if ( finalization_state ) {     // relay the finalized transition and go on with business. 
                        let state = finalization_state.state
                        let OK = finalization_state.OK
                        let t_state = { 'type' : 'finalize', 'OK' : OK, 'state' : state, 'reason' : 'matched' }
                        return [200,t_state]
                    } // else nothing worked 
                }
            }
        }
        return [200,{ 'type' : 'transition', 'OK' : 'false', 'reason' : 'unavailable' } ]
    }

    async ws_transition(transition,body) {
        let is_feasible = await this.session_manager.feasible(transition,body,null)
        if ( is_feasible ) {
            let finalization_state = await this.session_manager.finalize_transition(transition,body,{},null)      // FINALIZE (not a final state)
            if ( finalization_state ) {
                return finalization_state
            }
        }    
        return false
    }


    async endpoint_transition(transition,body) {
        try {
            if ( !(body.token) ) {  // no transition token ... so treat this as primary
                return this.transition_handler(transition,body,{})
            } else {
                return this.secondary_transition_handler(body,{})
            }    
        } catch (e) {
            return [200,{ 'type' : 'transition', 'OK' : 'false', 'reason' : 'unavailable' } ]
        }
    }

}




module.exports = TransitionHandling