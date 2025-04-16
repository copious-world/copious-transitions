
const FieldValidatorTools = require('./field-validator-tools')

/** 
 * Provide the operations necessary to do field validation.
 * 
 * This is a descendant of FieldValidatorTools and makes use of the method `setup_field_test`, when getting set up.
 * The `setup` method is called from the `intialize` method, called by the user processing clients.
 * 
 * Initialization attempts to take as much as it can from the configuration to set up the tests that fields will have to 
 * pass in order that a request may proceed. It takes test information from the configuration field `field_set`, which is a 
 * map of form identifers to objects containing fields belonging to the forms. Each field maps to a field descriptor.
 * 
 * 
 * The method `valid` is called by the 'contractual' code when new requests come in to the contractual processing.
 * 
 * 
 * 
 * 
 * 
 * 
 * @extends FieldValidatorTools
 * @memberof field_validators
 */

class GeneralValidator extends FieldValidatorTools {

    constructor() {
        super()
        this.db = null
        this.sessions = null
        this.self = null
        this.class_conf = false
        this.field_set = {} // all form fields by form
    }

    seeking_endpoint_paths() {
        return []
    }

    set_messenger(path,messenger) {
    }

    /**
     * Sets up the validators that will look for particular fields belonging to a query object.
     * 
     * The field set 
     */
    setup_tests() {
        let all_fields = this.field_set

        delete all_fields.reason // should be a text comment 

        for ( let form_key in all_fields ) {
            let form = all_fields[form_key]
            for ( let field in form ) {
                let fieldDescriptor = form[field]
                super.setup_field_test(form_key,field,fieldDescriptor)
            }
        }
    }

    /**
     * Takes in the configuration data necessary to intialize the `application_tests` table in the super (FieldValidatorTools).
     * Calls `setup_tests`.
     * 
     * @param {object} conf_obj 
     * @param {object} db 
     * @param {object} sessions 
     */
    initialize(conf_obj,db,sessions) {
        //
        this.db = db
        this.sessions = sessions
        //
        this.class_conf = conf_obj.validator
        if ( this.class_conf.field_set ) {     // first the configuration object
            this.field_set = clonify(this.class_conf.field_set)
        }
        //
        if ( this.self ) {              // second programmed and DB acces
            this.self.prepare_tests()   // the application adds to the *field_set* first provided by the configuration
        }

        this.setup_tests()
    }

    //
    /**
     * The list of fields will be from the `field_set` of this class.
     * The fields will be picked out by the name of a transition or operation.
     * If the list has not been defined by configuration, then this method will default to returning true, passing 
     * the validation of data entries (format, syntax, simple semantics).
     * 
     * First, if the `field` parameter is a string, this method searches for the fields object matching the key.
     * Given, the parameters is a string and is not in the `field_set`, this method will search in the local database for 
     * the field object.
     * 
     * If either the fields were pasts as an object or a search proved successful in finding it, the form data of the 
     * object, `post_body`, will be examined using the previously configured tests in the ``application_tests` table.
     * 
     * @param {object} post_body 
     * @param {object|string} fields - either a key to a list of a list.
     * @returns {boolean}
     */
    valid(post_body,fields) {  // a particular set of fields for a form 
        //
        if ( fields === undefined ) return(true)
        //
        if ( typeof fields === "string" ) {   // first make sure that a field object is given
            let fields_key = fields
            fields = this.field_set[fields_key]
            if ( fields === undefined ) {
                fields = this.db.fetch_fields(fields_key) // 
                if ( fields !== undefined) {            // add it into our local field cache 
                    this.field_set[fields_key] = fields // a dynamic update, but may have to be pruned at some time.
                }
            }
        }
        //
        let form = post_body.form_key ? post_body.form_key : ''
        for ( let field in fields ) {        // now the post body should have keys to data fields 
            let field_info = post_body[field]
            if ( field && field_info ) {
                let ftest = super.get_field_test(form,field)
                if ( ftest ) {
                    if ( !ftest.test(post_body[field],ftest.parameters) ) return(false)
                }
            } else {
                return false
            }
        }
        return true
    }


}



module.exports = GeneralValidator
