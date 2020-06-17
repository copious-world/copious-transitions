
const GeneralValidator = require('lib/general_validator')


class MediaUpValidator extends GeneralValidator {

    constructor() {
        super()
        this.self = this
    }
    //
    prepare_tests() {  // application specific not in the conf ... may be in the db  .. add to the field_set object of the GeneralValidator
        // ADD IN A MediaUp VALIDATION... 
        //
        // load application fields
        // this.application_tests = {} // each applicaton has to set up its own
    }

}



module.exports = new MediaUpValidator()
