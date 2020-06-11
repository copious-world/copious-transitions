//
//

// A set of server side tests that may be used and that assume that the 
// client has done most of the testing. These are supposed to be short tests that 
// mostly ensure the form data has come from a valid client. But, more compute may be used if desired. 

class FieldTest {
    constructor(descriptor) {
        this.parameters = {}
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

FieldTest,EmailField,EmailVerifyField

class EmailField extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
        // this.parameters = {} additional options
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

class EmailVerifyField extends EmailField {
    constructor(descriptor) {
        super(descriptor)
        // this.parameters = {} additional options
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}



class PasswordField extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

class PasswordVerifyField extends PasswordField {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}




class LengthyField extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}


class LengthyStringField extends LengthyField {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

class LengthyDigitalField extends LengthyField {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}



class LengthyAlphabetField extends LengthyField {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

class TypeCheckField extends FieldTest {
    constructor(descriptor) {
        super(descriptor)
    }
    test(field_data,test_params) { // by defaul all fields pass
        return(true)
    }
}

class DataLookupField extends TypeCheckField {
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
    "from-db" : DataLookupField
}
    



class FieldValidatorTools {
    constructor() {
        this.application_tests = {} // each applicaton has to set up its own
        this.field_classes = this.init_field_classes()
    }
    //
    init_field_classes() {
        return(g_all_field_class)
    }
    //
    generate_tester(fieldDescriptor) {
        let field_class = this.field_classes[fieldDescriptor.field_type]
        let field_tester = new field_class(fieldDescriptor)
        return(field_tester)
    }
    //
    setup_field_test(form,field,fieldDescriptor) {
        let field_key = form + field
        this.application_tests[field_key] = this.generate_tester(fieldDescriptor)
    }
    //
    get_field_test(form,field) {
        let field_key = form + field
        return(this.application_tests[field_key])
    }
}


module.exports = FieldValidatorTools