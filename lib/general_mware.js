
/** 
 * Middleware is the set of methods that a web application handler may call upon in order to customize 
 * parsing and filtering of the HTTP headers. 
 * This class provides a template for entering chosen middleware into the intialization queues from the application 
 * level; so that, applications may choose middeware and allow this class to manage its use for them. 
 * 
 * @memberof base
 */

class GeneralMiddleWare {

    constructor() {
        this.db = null
        this.middle_ware = []
    }

    initialize(config) {
        this.conf = config
        this.class_conf = config.middleware
    }

    add(mware) {
        this.middle_ware.push(mware)
    }

    setup(exp_app,db_obj,sessions) {
        if ( this.db === null ) {
            this.db = db_obj
        }
        this.app = exp_app
        this.sessions = sessions
        if ( sessions.middle_ware && Array.isArray(sessions.middle_ware) ) {
            this.uses(sessions.middle_ware)  // if the session, being previously initialized added its own middleware
        }
        this.uses(this.middle_ware)
    }

    uses(middleware) {
        middleware.forEach(mware => {
            this.app.use(mware)
        });
    }

}



module.exports = GeneralMiddleWare
