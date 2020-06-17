const GeneralMiddleWare = require('lib/general_middleware')


var bodyParser = require('body-parser');
var cors = require('cors')


// create application/json parser
var jsonParser = bodyParser.json()
// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })



class MediaUpMiddleWare extends GeneralMiddleWare {

    constructor() {
        super()
    }

    setup(app,db,session_manager) {
        //
        let conf = app._extract_conf()
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



module.exports = new MediaUpMiddleWare()