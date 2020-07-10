


class ShutdownManager {
    constructor() {
        this.shutdown_set = {}
    }

    add_me_to_shutdown(obj) {
        this.shutdown_set[obj._id] = obj
    }

    shutdown_all() {
        for ( let ky in this.shutdown_set ) {
            let obj = this.shutdown_set[ky]
            try {
                obj.shutdown()
            } catch(e) {
            }
        }
    }
}


module.exports = ShutdownManager