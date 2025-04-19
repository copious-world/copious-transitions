
const { LinkManager } = require('../../index')




class DefaultEndPointServer extends LinkManager {

    //
    constructor(conf) {
        super(conf)
    }

}


//
//
module.exports = DefaultEndPointServer      // In this case, export the class and do not construct

