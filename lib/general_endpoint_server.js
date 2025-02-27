
const AppLifeCycle = require("./general_lifecyle")
const DEFAULT_TRANSITION_ENDPOINT = "./transition-endpoint-server"

/** 
 * 
 * The most basic version of this transition engine is an endpoint manager.
 * This 
 * 
 * especially useful for uploaders or other types of processes that 
 * use a backend servrer conversation in order to expose validated endpoints
 * to the user facing services (web servers)
 * 
 * NOTE: all the base classes in /lib return the class and do not return an instance. Explore the applications and 
 * the reader will find that the descendant modules export instances. The classes provided by copious-transitions must
 * be extended by an application.
 * 
 * @memberof base
 */
class EndpointManager extends AppLifeCycle {

    constructor() {
        super()
        this.trans_processor = false
        this.user_processor = false
        this.endpoint_service = false
        this.web_sockets = false
    }


    /**
     * Give the enpoint to the contractual 
     * @param {object} trans_processor 
     * @param {object} user_processor 
     * @param {object} mime_processor 
     */
    set_contractual_filters(trans_processor,user_processor,mime_processor) {
        this.trans_processor = trans_processor
        this.user_processor = user_processor
        this.mime_processor = mime_processor
    }


    /**
     * Accepts a reference to the application supplied web socket server manager and sets the `web_sockets` field to it.
     * 
     * @param {object} web_sockets - the reference to the application supplied web socket server manager.
     */
    set_ws(web_sockets) {
        this.web_sockets = web_sockets
    }

    /**
     * Checks for the `transition_endpoint` field on the configuration object (conf).
     * 
     * If the `transition_endpoint` field is an object, this assumes that the object is a configuration 
     * that can be passed to `initialize_endpoint_services`.
     * 
     * @param {object} conf 
     * @param {object} db 
     */
    initialize(conf,db) {
        this.conf = conf
        this.db = db

        console.log(conf.transition_endpoint, "TRANSTIONS ENDPOINT")
        if ( (conf.transition_endpoint !== undefined) && (typeof conf.transition_endpoint === 'object') ) {
            this.initialize_endpoint_services(conf.transition_endpoint)
        }
    }


    /**
     * Creates a transition endpoint based on the class determined by configuration.
     * The field `endpoint_module`  (i.e. `conf.transition_endpoint.endpoint_module`) provides 
     * the name of the module to require if it is supplied. If it is not mentioned, then 
     * the default transition endpoint will be used. 
     * 
     * (Applications seeking to supply an endpoint server for transition processing should overrided the default.)
     * 
     * An instance of the class will be created. The creation of this class will result in a listening server on a tls port.
     * 
     * Once the class is created and no error has been encountered,
     * the transition handler and the mime handler may be set. (Note: the user processes is not handled through the endpoint server.)
     * 
     * Any version of this method should call upon the transion processor for using the endpoint transition.
     * Also, it should call upon the mime handler to access static assets. The methods called will be the following:
     * 
     * * `endpoint_transition`
     * * `static_asset_handler`
     * 
     * In the supplied handlers, a server id is required to be included in the message object coming from a message relay client.
     * The message object will be passed on to the contractual module handling the use case (transition or mime).
     * 
     * Finally, the results are passed back to the message hanlder the called the transition/mime handler.
     * The message handler will handle the client message response. 
     * 
     * 
     * @param {object} conf 
     * @returns {object}
     */
    initialize_endpoint_services(conf) {
        if ( conf === undefined ) return
        //
        let TransitionalEndpoint = require((conf.transition_endpoint_module !== undefined) ? conf.transition_endpoint_module : DEFAULT_TRANSITION_ENDPOINT)

        if ( TransitionalEndpoint !== undefined ) {
            this.endpoint_service = new TransitionalEndpoint(conf)
            this.endpoint_service.set_transition_handler(async (transition,msg_obj) => {
                // called from app_message_handler  (see endpoint service message-relay-services)
                let server_id = msg_obj ? msg_obj.server_id : false
                if ( server_id && this.trans_processor ) {      // transitional
                    let result = await this.trans_processor.endpoint_transition(transition,msg_obj)
                    return result[1]  // this will send back the JSON object without HTTP status codes
                } 
            })
    
            this.endpoint_service.set_mime_handler(async (asset,msg_obj) => {
                // called from app_message_handler  (see endpoint service message-relay-services)
                let server_id = msg_obj ? msg_obj.server_id : false
                if ( server_id && this.this.mime_processor ) {      // transitional
                    msg_obj._x_c$trns_path = "set_mime_handler"
                    let result = await this.this.mime_processor.static_asset_handler(asset,msg_obj)
                    return [result[1] ,result[2]] // [1] is mime type object, [2] is a string determined by the app
                }
            })
        } else {
            throw new Error("general endpoint server: no TransitionalEndpoint class type provided by configuration or default")
        }

        //
        return {}
    }



    initialize_service_configuration(link_manager) {
        this.endpoint_service.initialize_service_configuration(link_manager)
    }

}




module.exports = EndpointManager
