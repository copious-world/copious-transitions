const { GeneralTransitionEngine } = require.main.require('./lib/general_transition_engine')

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//
class DefaultEngineClass extends GeneralTransitionEngine {
    //
    constructor() {
        super()
    }
}


//
module.exports = new DefaultEngineClass()
