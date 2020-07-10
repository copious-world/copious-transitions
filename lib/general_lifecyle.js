


class GeneralAppLifeCycle {

    //
    constructor() {
        this.intervalRefs = []
        this.timerRefs = {}
        this.app_shutdown = false
        this.tindex = 0

        global_shutdown_manager.add_me_to_shutdown(this)
    }

    //
    shutdown() {
        if ( this.intervalRefs && this.intervalRefs.length ) {
            this.intervalRefs.forEach((interval) => {
                clearInterval(interval)
            })
        }
        this.intervalRefs = []
        if ( this.timerRefs ) {
            for ( let tt in this.timerRefs ) {
                this.remove_timer(tt)
            }
        }
        this.timerRefs = null
        //
        if ( this.app_shutdown && ( typeof this.app_shutdown === "function" ) ) {
            this.app_shutdown()
        }
    }

    add_interval(iref) {
        this.intervalRefs.push(iref)
    }

    // remove_interval -- for the application if the interval is removed before shutdown
    remove_interval(iref) {
        let idx = this.intervalRefs.indexOf(iref)
        if ( idx >= 0 ) {
            clearInterval(iref)
            this.intervalRefs.splice(idx,1)
        }
    }

    add_timer(tt,timer) {
        this.timerRefs[tt] = timer
    }
    
    remove_timer(tt) {
        let timerRef = this.timerRefs[tt]
        if ( timerRef ) clearTimeout(timerRef)
        delete this.timerRefs[tt]
    }

    // add_timeout  -- best for timers expected to be extant for a long time (shorter ones might be managed by their app)
    add_timeout(fn,time_lapse) {
        let tt = this.tindex++
        let timer = setTimeout(() => { this.removeTimer(tt), fn()}, time_lapse)
        this.add_timer(tt,timer)
    }

}


module.exports = GeneralAppLifeCycle