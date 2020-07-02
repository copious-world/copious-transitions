//


class GeneralMiddleWare {

    constructor() {
        this.db = null
        this.middle_ware = []
    }

    initialize(db_obj) {
        this.db = db_obj
    }

    add(mware) {
        this.middle_ware.push(mware)
    }

    setup(exp_app,db_obj,sessions) {
        if ( this.db === null ) {
            this.initialize(db_obj)
        }
        this.app = exp_app
        this.sessions = sessions
        this.uses(sessions.middle_ware)
        this.uses(this.middle_ware)
    }

    uses(middleware) {
        middleware.forEach(mware => {
            this.app.use(mware)
        });
    }

}



module.exports = GeneralMiddleWare
