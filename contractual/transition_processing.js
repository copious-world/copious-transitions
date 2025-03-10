
const LocalTObjectCache = require('../default_storage/local_object_cache')

/**
 * Transition handling is a collection of POST method responses designed to provide executive action. 
 * There are just a few methods that guide the process by puting the request through tests supplied by the 
 * session manager, a validator, and a transition processor until a transition finalization method can be called. 
 * 
 * A transition may operate in response to a single request, or it might cache salietn data and utimately achieve finalization 
 * after negotiating a second request with the requesting client.
 * 
 * The basic method that runs a transition is `transition_handler`. And, if a secondary action is required for a transition, 
 * the `secondary_transition_handler` method will be invoked in response to the appropriate request from the requesting client.
 * 
 * Two other methods are provided by this class, `ws_transition` and `endpoint_transition`. These methods work in response to 
 * messages from communication paths other than HTTP communication paths. While the `CopiousTransitions` sets up an HTTP(s) web 
 * server and handles requests coming to certain types of API paths, the other methods use WebSockets in one case and TCP(tls) 
 * communication in the second case. These methods call upon `transition_handler` and `secondary_transition_handler` to do their work.
 * They will then shape their responses to WS clients or relay clients. 
 * 
 * Note that one can imagine a transtion machine implemented explicitly in the application and that a single transition machine instance can
 * belong to a session. Some applications may implement the actual transition machine. Often, though, the transition machine
 * is a set of calls out to the DB interface or to the transition engine, which might send data somewhere or publish a message.
 * The point of these methods is to create a skeleton for the flow of transition processing.
 * 
 * @memberof Contractual
 * @extends LocalTObjectCache
 */

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

    /**
     * The transition hanlder is the CopiousTransitions entry point into an application's state transition 
     * implementation. This method supplies the basic framework for stepping the transition request through permission, 
     * acceptance, processing setup, until the state transition can be finalized either in response to the first request or
     * in response to a secondary request (`secondary_action`).
     * 
     * The transition handler first calls the session manager's guard. The guard can provide a certain amount of access control
     * and may also know about the state of the server and the permissibility of certain types of transactions.  A failure 
     * to pass the guard yields a reson of unavailability to the requester.
     * 
     * If the guard is passed, the validator checks the trasition body for addmissable data types, etc. In many use case, 
     * the call to the validator is moot. Yet, in some operations the application will prvodide checking methods that the 
     * validator framework can use.
     * 
     * After validation, the transition is examined for feasibility. By feasibility is meant that the state of the server relative to the session
     * can allow for the transition to a desired state and that the resources required for the transition are available. The check must be
     * determined by the application. The check can be any degree of complexity from something simple such as accepting the name of 
     * the transition to something quite complicated such as checking that certain machines are attached to the server and that certain 
     * measurement are with desired ranges. What is provided here, is that the transition server will call on the feasibility test provided 
     * by the application after validation and before transition processing and, furthermore, the transition handler will wait (await)
     * the completion of the feasibility testing.
     * 
     * Requests remaining after they are deemed feasible, can be processed using the session manager's `process_transition`,
     * which sets up the data needed for finalization and determines if the transaction will happen in one step or 
     * require a secondary action.
     * 
     * Those transitions that can be done in one step proceed immediately to finalization. The finalization method, provided 
     * by the application, should set the state transition for the session. The method should result in a the transition machine
     * owned by the session being in an identifiable state. When the session is queried for the state of the machine, the state 
     * of the last finalization should be reported. A query of the state should remain the same with respect to the session 
     * until another state transition is requested.
     * 
     * Those transitions requiring a secondary action before finalization will cache data in preparation for the second action to be done 
     * in response to an ensuing request. The transition handler calls out to the dynamic data producer to produce the data to be cached.
     * The transition handler will cache the data using the methods provided by LocalTObjectCache; the data is cached
     * into a map structure with the transition's token as the key. Once the data is cached, 
     * the partial transition object containing data for the client will be sent to the requester along with the parts of the generated data chosen to be sent. Data is sent 
     * in preparation for the secondary action according to a contract of design established for the synchronization of client and server
     * operations and negotiations.
     * 
     * Given the client comes back with the request for the seconary action, the next handler `secondary_transition_handler` will 
     * continue the process of progression the transtion to finalization.
     * 
     * @param {string} transition - the type of transition the client is requesting. See documentation about tagged transisions.
     * @param {object} body 
     * @param {object} transmision_headers 
     * @returns {Array} - a tupple really, that has: 1) the status code, 2) the JSON response, 3) possibly data or boolean (false for not in use)
     */

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
                            transition = ((transitionObj.transition !== undefined) ? transitionObj.transition : transition)
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

    /**
     * This method progresses a transtion request towards finalization provided that the transition can be identified by its token.
     * The previously generated data that was not sent to the client will be extracted from the transition object keyed by the token.
     * 
     * Just one check, a match between the object sent in the request from the client and the cached transition object needs to pass. 
     * The match test might be one of a number of possible checks, ranging in in complexity from the check to see is a field is present, to 
     * checking if same name fields of the two objects are equal, to signature verification using elliptic key crypotgraphy, or perhaps more. 
     * The match implementation is part of the application.
     * 
     * Once the match is passed, the secondary transition handler calls up the transition finalization method for the transition machine 
     * operating with respect to the current session. 
     * 
     * 
     * @param {object} body 
     * @param {object} transmision_headers 
     * @returns {Array} - a tupple really, that has: 1) the status code, 2) the JSON response, 3) possibly data or boolean (false for not in use)
     */
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
                        let OK = finalization_state.OK  // as a string
                        let t_state = { 'type' : 'finalize', 'OK' : OK, 'state' : state, 'reason' : 'matched' }
                        return [200,t_state]
                    } // else nothing worked 
                }
            }
        }
        return [200,{ 'type' : 'transition', 'OK' : 'false', 'reason' : 'unavailable' } ]
    }

    /**
     * This method does a very short one step version of transtion processing in response to websocket 
     * messages inbound from the client. This method only check on the feasiblily of the transition and 
     * if it finds it feasible, the transition will be move on to finalization.
     * 
     * @param {string} transition 
     * @param {object} body 
     * @returns {Array} - a tupple really, that has: 1) the status code, 2) the JSON response, 3) possibly data or boolean (false for not in use)
     */
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


    /**
     * This method is named `endpoint_transition` due to its servicing the operations of an endpoint server (as defined in the package
     * message-relay-server). This method looks for a token on the message (body). If the token is not there, it assumes the 
     * message arriving at the endpoint is in the first phase of transition processing and sends the data on to the transition handler.
     * 
     * If the token is present, the method assumes that the message is targeted to the secondary action. 
     * 
     * The branches return the result of the methods they call, and the UserMessageEndpoint instance is written to 
     * send the response back to the relay client (message-relay-server) in an appropriate form using the transtion hanlder results.
     * 
     * @param {string} transition 
     * @param {object} body 
     * @returns {Array} - a tupple really, that has: 1) the status code, 2) the JSON response, 3) possibly data or boolean (false for not in use)
     */
    async endpoint_transition(transition,body) {
        try {
            if ( !(body.token) ) {  // no transition token ... so treat this as primary
                return await this.transition_handler(transition,body,{})
            } else {
                return await this.secondary_transition_handler(body,{})
            }    
        } catch (e) {
            return [200,{ 'type' : 'transition', 'OK' : 'false', 'reason' : 'unavailable' } ]
        }
    }

}




module.exports = TransitionHandling