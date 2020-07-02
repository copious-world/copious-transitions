const AppLifeCycle = require("./general_lifecyle")

class GeneralDynamic extends AppLifeCycle {
    constructor(conf) {
        super()
        //
    }

    fetch(asset) {
        // proecess this asset and return it.
        let assetObj = {
            'string' : 'not yet implemented',
            'mime_type' : 'text/plain'
        }

        return(assetObj)
    }
}


module.exports = GeneralDynamic

