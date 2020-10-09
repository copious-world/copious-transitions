const GeneralMiddleWare = require.main.require('./lib/general_mware')

class DefaultMiddleWare extends GeneralMiddleWare {
    constructor() {
        super()
    }
}



module.exports = new DefaultMiddleWare()