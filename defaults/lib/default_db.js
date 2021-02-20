const { DBClass } = require.main.require('./lib/general_db')

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//


class DefaultDBClass extends DBClass {

    //
    constructor() {
        super()
    }

}


//
//
module.exports = new DefaultDBClass()
