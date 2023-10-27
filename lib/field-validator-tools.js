//
//

/**
 * 
 * @namespace field_validators
 */

/**
 * A set of server side tests which may be used to filter queries
 * These tests assume that the client has done most of the filter testing.
 * These are supposed to be short tests that mostly ensure the form data has come from a valid client.
 * 
 * Useful for debugging.
 * 
 * @memberof field_validators
 */
class FieldTest {
    constructor(descriptor) {
        this.parameters = {}
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

//FieldTest,EmailField,EmailVerifyField

/**
 * @extends FieldTest
 * @memberof field_validators
 */
class EmailField extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
        // this.parameters = {} additional options
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

/**
 * @extends FieldTest
 * @memberof field_validators
 */
class EmailVerifyField extends EmailField {
    constructor(descriptor) {
        super(descriptor)
        // this.parameters = {} additional options
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}


/**
 * @extends FieldTest
 * @memberof field_validators
 */
class PasswordField extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

/**
 * @extends FieldTest
 * @memberof field_validators
 */
class PasswordVerifyField extends PasswordField {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}



/**
 * @extends FieldTest
 * @memberof field_validators
 */
class LengthyField extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}


/**
 * @extends LengthyField
 * @memberof field_validators
 */
class LengthyStringField extends LengthyField {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

/**
 * 
 * @memberof field_validators
 */
class LengthyDigitalField extends LengthyField {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}


/**
 * @extends LengthyField
 * @memberof field_validators
 */
class LengthyAlphabetField extends LengthyField {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

/**
 * @extends FieldTest
 * @memberof field_validators
 */
class TypeCheckField extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

/**
 * @extends FieldTest
 * @memberof field_validators
 */
class DataLookupField extends TypeCheckField {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }    
}


/**
 * @extends FieldTest
 * @memberof field_validators
 */
class ForeignAuth extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}



var g_all_field_class = {
    "email" : EmailField,
    "email-verify" : EmailVerifyField,
    "password" : PasswordField,
    "password-verify" : PasswordVerifyField,
    "lengthy" : LengthyField,
    "lengthy-string" : LengthyStringField,
    "lengthy-number" : LengthyDigitalField,
    "lengthy-alpha" : LengthyAlphabetField,
    "type-restricted" : TypeCheckField,
    "from-db" : DataLookupField,
    "foreign_auth" : ForeignAuth
}
    


/**
 *  A class that helps apply the field filter tests...
 * @memberof field_validators
 */
class FieldValidatorTools {
    constructor() {
        this.application_tests = {} // each applicaton has to set up its own
        this.field_classes = this.init_field_classes()
    }
    
    /**
     * 
     * @returns - list of field classes configured for this application
     */
    init_field_classes() {
        return(g_all_field_class)
    }
    //
    /**
     * 
     * @param {object} fieldDescriptor 
     * @returns {boolean}
     */
    generate_tester(fieldDescriptor) {
        let field_class = this.field_classes[fieldDescriptor.field_type]
        if ( field_class ) {
            let field_tester = new field_class(fieldDescriptor)
            return(field_tester)    
        }
        return(false)
    }
    //
    /**
     * 
     * @param {string} form 
     * @param {string} field 
     * @param {object} fieldDescriptor 
     */
    setup_field_test(form,field,fieldDescriptor) {
        let field_key = form + field
        this.application_tests[field_key] = this.generate_tester(fieldDescriptor)
    }
    //
    /**
     * 
     * @param {string} form 
     * @param {string} field 
     * @returns {Function}
     */
    get_field_test(form,field) {
        form = form ? form : ''
        let field_key = form + field
        return(this.application_tests[field_key])
    }
}


module.exports = FieldValidatorTools