



class GeneralAppLifeCycle {

    //
    constructor() {
        this.intervalRefs = []
        this.timerRefs = []
        this.app_shutdown = false
    }

    //
    shutdown() {
        if ( this.intervalRefs && this.intervalRefs.length ) {
            this.intervalRefs.forEach((interval) => {
                clearInterval(interval)
            })
        }
        if ( this.timerRefs && this.timerRefs.length ) {
            this.timerRefs.forEach((timer_r) => {
                clearTimeout(timer_r)
            })
        }
        if ( this.app_shutdown && ( typeof this.app_shutdown === "function" ) ) {
            this.app_shutdown()
        }
    }

}


module.exports = GeneralAppLifeCycle