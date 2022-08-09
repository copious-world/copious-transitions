const {GeneralMiddleWare} = require('../../index')

class DefaultMiddleWare extends GeneralMiddleWare {
    constructor() {
        super()
    }
}



module.exports = new DefaultMiddleWare()