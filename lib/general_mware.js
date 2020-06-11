//


class GeneralMiddleWare {

    constructor() {

    }

    initialize(db_obj) {
        this.db = db_obj
        this.middle_ware = []
    }

    add(mware) {
        this.middle_ware.push(mware)
    }

    setup(exp_app,db_obj,sessions) {
        this.initialize(db_obj)
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
