
const FieldValidatorTools = require('./field-validator-tools')

/** 
 * Provide the operations necessary to do field validation
 * @extends FieldValidatorTools
 * @memberof field_validators
 */

class GeneralValidator extends FieldValidatorTools {

    constructor() {
        super()
        this.db = null
        this.sessions = null
        this.self = null
        this.field_set = {} // all form fields by form
    }

    //
    initialize(conf_obj,db,sessions) {
        //
        this.db = db
        this.sessions = sessions
        //
        if ( conf_obj.field_set ) {     // first the configuration object
            this.field_set = clonify(conf_obj.field_set)
        }
        //
        if ( this.self ) {              // second programmed and DB acces
            this.self.prepare_tests()   // the application adds to the *field_set* first provided by the configuration
        }

        this.setup_tests()
    }

    //
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

}



module.exports = GeneralValidator
