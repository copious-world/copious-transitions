//
//

/**
 * Note: there may have been actual data test in the test methods at some point in the past. 
 * The tests are not provided by this library.  
 * The list of field test classes provided stand in for those that can be provided by an application.
 * 
 * It is expected that application will override the `init_field_classes` method of the class FieldValidatorTools
 * 
 * @namespace field_validators
 */

/**
 * A set of server side tests which may be used to filter queries
 * These tests assume that the client has done most of the filter testing.
 * These are supposed to be short tests that mostly ensure the form data has come from a valid client.
 * 
 * The heighest level class merely sets up the parameter map of the test, and provides the basic test method,
 * which is overridden here, and should be extensively overridden by applications expecting to use validity tests.
 * 
 * Each extending sublcass will be a test for a particular type of field. 
 * 
 * Form fields are tied to FieldTest types of objects by examining the `field_type` of the field descriptor introducd by 
 * configuration. The `FieldValidatorTools` keeps a table of field class (`field_classes`), that map from the configuration string to 
 * the actual class which can be constructed the field type.
 * 
 * @memberof field_validators
 */
class FieldTest {
    constructor(descriptor) {
        this.parameters = {}
    }

    /**
     * Each extending subclass of FieldTest will supply a `test` method.
     * The object parameter 'field_data' will supply data from the fields of a Form (HTML form). 
     * The test method will a also take `test parameters`, which will supply the syntactic and semantic 
     * contraints on the value of the paritcular type of field represented by the class.
     *  
     * @param {object} field_data 
     * @param {object} test_params 
     * @returns {boolean} - true if the test passes
     */
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

//FieldTest,EmailField,EmailVerifyField

/**
 * Typically, a form will request an email. This class can check that the email matches syntax.
 * It is possible that it can do a lengthier test to find if it actually exists. 
 * Often, email is used as identity, but not all applications use email. Some don't require email for idenity.
 * 
 * @extends FieldTest
 * @memberof field_validators
 */
class EmailField extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
        // this.parameters = {} additional options
    }
    /**
     * 
     * @param {object} field_data 
     * @param {object} test_params 
     * @returns {boolean} - true if the test passes
     */
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

/**
 * In many applications, a form will request that the user repeat the email to increase the chance of both entries
 * are correct. 
 * @extends FieldTest
 * @memberof field_validators
 */
class EmailVerifyField extends EmailField {
    constructor(descriptor) {
        super(descriptor)
        // this.parameters = {} additional options
    }

    /**
     * 
     * @param {object} field_data 
     * @param {object} test_params 
     * @returns {boolean} - true if the test passes
     */
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}


/**
 * Many applications accept a password for verification of identity.
 * Thise server side check can first determine if the password is formatted according to the rules of 
 * password creation for the application.
 * 
 * @extends FieldTest
 * @memberof field_validators
 */
class PasswordField extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
    }
    /**
     * 
     * @param {object} field_data 
     * @param {object} test_params 
     * @returns {boolean} - true if the test passes
     */
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

/**
 * In many applications, a form will request that the user repeat the password to increase the chance of both entries
 * are correct. 
 * 
 * @extends FieldTest
 * @memberof field_validators
 */
class PasswordVerifyField extends PasswordField {
    constructor(descriptor) {
        super(descriptor)
    }
    /**
     * 
     * @param {object} field_data 
     * @param {object} test_params 
     * @returns {boolean} - true if the test passes
     */
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}



/**
 * Some applications use form fields that contain a limited number of characters.
 * And, the charcacters can be of any type.
 * 
 * @extends FieldTest
 * @memberof field_validators
 */
class LengthyField extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
    }
    /**
     * 
     * @param {object} field_data 
     * @param {object} test_params 
     * @returns {boolean} - true if the test passes
     */
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}


/**
 * 
 * Some applications use form fields that contain a limited number of characters.
 * And, the charcacters should be something other than pure numbers.
 * 
 * @extends LengthyField
 * @memberof field_validators
 */
class LengthyStringField extends LengthyField {
    constructor(descriptor) {
        super(descriptor)
    }
    /**
     * 
     * @param {object} field_data 
     * @param {object} test_params 
     * @returns {boolean} - true if the test passes
     */
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

/**
 * Some applications use form fields that contain a limited number of characters.
 * And, the charcacters should be pure numbers.
 * 
 * @memberof field_validators
 */
class LengthyDigitalField extends LengthyField {
    constructor(descriptor) {
        super(descriptor)
    }
    /**
     * 
     * @param {object} field_data 
     * @param {object} test_params 
     * @returns {boolean} - true if the test passes
     */
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}


/**
 * Some applications use form fields that contain a limited number of characters.
 * And, the charcacters should be alphabet characters only.
 * 
 * @extends LengthyField
 * @memberof field_validators
 */
class LengthyAlphabetField extends LengthyField {
    constructor(descriptor) {
        super(descriptor)
    }
    /**
     * 
     * @param {object} field_data 
     * @param {object} test_params 
     * @returns {boolean} - true if the test passes
     */
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

/**
 * 
 * Some applications use form fields that contain some type, e.g. boolean, structure, etc.
 * Some application may check that a field contains a type and the application will provide 
 * code to see if it conforms to a known type.
 * 
 * @extends FieldTest
 * @memberof field_validators
 */
class TypeCheckField extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
    }
    /**
     * 
     * @param {object} field_data 
     * @param {object} test_params 
     * @returns {boolean} - true if the test passes
     */
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

/**
 * Some applications may provide a field check that will see if the data can be used to produce some result 
 * from a DB query.
 * 
 * @extends FieldTest
 * @memberof field_validators
 */
class DataLookupField extends TypeCheckField {
    constructor(descriptor) {
        super(descriptor)
    }
    /**
     * 
     * @param {object} field_data 
     * @param {object} test_params 
     * @returns {boolean} - true if the test passes
     */
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }    
}


/**
 * Some applications may provide a field that allows external applications to enter in a value.
 * And, the value should be verified as coming from the external application before the value can be used.
 * 
 * @extends FieldTest
 * @memberof field_validators
 */
class ForeignAuth extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
    }
    /**
     * 
     * @param {object} field_data 
     * @param {object} test_params 
     * @returns {boolean} - true if the test passes
     */
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
 * A class that helps apply the field filter tests...
 * This class manages the creation of the lookup table for assigning classes set up in
 * the filed classes table to class instances that provide test methods. 
 * 
 * When the validator is created, the form identifiers and the field identifiers will be put together
 * for the verifier access when checking fields associated with post requests. 
 * 
 * The table `application_tests` maps the concatinated form name + field name to the test class instance.
 * 
 * 
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
     * Given the field descriptor from a configuration, identifies the constructor from `field_type` of the descriptor.
     * Creates a new instance of the FieldTest type of object 
     * 
     * @param {object} fieldDescriptor 
     * @returns {boolean|object} false if the class constructor is not in the table, otherwise a new class instance
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
     * Concatinates the form idenifier with the field identifier to make a key for the new verification test entry.
     * Add the key, value pair to the `application_tests` table.
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
     * The validation method of the application's validator calls this to get a test method to apply to the field 
     * of the form. Use the concatenated form idenifier/field identifier key to find the test.
     * Returns the FieldTest instance.
     * 
     * @param {string} form 
     * @param {string} field 
     * @returns {object}
     */
    get_field_test(form,field) {
        form = form ? form : ''
        let field_key = form + field
        return(this.application_tests[field_key])
    }
}


module.exports = FieldValidatorTools