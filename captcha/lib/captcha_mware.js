const {GeneralMiddleWare} = require("../../index")


const bodyParser = require('body-parser');
const cors = require('cors')

// create application/json parser
const jsonParser = bodyParser.json()
// create application/x-www-form-urlencoded parser
const urlencodedParser = bodyParser.urlencoded({ extended: false })


class CaptchaMiddleWare extends GeneralMiddleWare {

    constructor() {
        super()
    }

    setup(app,db,session_manager) {
        //
        let conf = app._extract_conf()
        this.initialize(db)
        //
        let appCors = null
        if ( conf.cors ) {
            appCors = cors(conf.cors) // check on params, etc.
        } else {
            appCors = cors()
        }
        // //
        //
        this.add(jsonParser)
        this.add(urlencodedParser)
        this.add(appCors)
        //
        super.setup(app,db,session_manager)
    }

}



module.exports = new CaptchaMiddleWare()