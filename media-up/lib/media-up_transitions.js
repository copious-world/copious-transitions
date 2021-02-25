
const TaggedTransition = require.main.require('./lib/tagged_transitions')
const uuid = require('uuid/v4')

// Contact Paths
class UploaderPaths extends TaggedTransition {
    constructor() {
        super("upload")
        this.static_entries = [ "demo-uploader", "publication-uploader" ] // for this app used by  passing(asset)
    }
    //
    transform_file_name(file_name) {
        return(file_name.replace('.','_'))
    }

    file_entry_id(file_key) {
        return("")
    }

    update(data) {
        data.pass = generate_password()
        return(data)
    }
}

class MediaSubmitTransition extends TaggedTransition {
    constructor(trans) {
        super(trans)
    }
    //
    transform_file_name(proto_file_name) {
        let extendable_file = proto_file_name.replace('.','_')
        extendable_file = extendable_file.replace('@','_A_')
        return(extendable_file)
    }
    primary_key() {
        return('email')
    }

    file_entry_id(file_key) {
        return('')
    }

    directory() {
        return(process.cwd() + '/uploads')
    }

}

class DemoSubmissionPaths extends MediaSubmitTransition {
    constructor() {
        super("do_demo_upload")
    }
    file_entry_id(file_key) {
        return('_singer')
    }
    file_type() {
        return('mp3')
    }
}

class PubSubmissionPaths extends MediaSubmitTransition {
    constructor() {
        super("do_publication_upload")
    }
    file_entry_id(file_key) {
        return('_' + file_key + '_soday')
    }
    file_type() {
        return('mp3')
    }
}


// 'dashboard-options'
class ConfigurableSubmissionPaths extends MediaSubmitTransition {

    constructor() {
        super("do_param_upload")
        this.business = false
        this.transition_defs = {}
        this.current_file_in_motion = false
        this.target_dir = false
    }

    prep(pars) {
        if ( pars && this.transition_defs ) {
            let conf_keys = pars.file_topic
            let pars = this.transition_defs[conf_keys]
            if ( pars ) {
                this.current_file_in_motion = pars
                let custom_path = pars[this.primary_key()]
                if ( custom_path && pars.category ) {
                    this.target_dir = '/' + custom_path + '/' + pars.category
                } else if ( custom_path ) {
                    this.target_dir = '/' + custom_path
                } else {
                    this.target_dir = '/uploads'
                }
            }
            return
        }
        this.current_file_in_motion = false
    }

    file_entry_id(file_key) {
        let filediff = this.current_file_in_motion.differentiator
        if ( filediff ) {
            return('_' + file_key + filediff)
        }
        return('_' + file_key + '_from_dash')
    }

    file_type() {
        if (  this.current_file_in_motion.ext ) {
            return this.current_file_in_motion.ext
        }
        return('json')
    }

    initialize(conf) {
        this.transition_defs = conf.transition_defs

    }

    directory() {
        let base_dir = this.current_file_in_motion.dir
        if ( !(base_dir) ) {
            base_dir = process.cwd()
        }
        if ( this.target_dir ) {
            return(base_dir + this.target_dir )
        }
        return(base_dir + '/uploads')
    }

}



class MediaUpCustomTransitions {
    constructor() {
        this.uploader_keyed = new UploaderPaths()
        this.demo_submission_keyed = new DemoSubmissionPaths()
        this.pub_submission_keyed = new PubSubmissionPaths()
        this.config_submission_keyed = new ConfigurableSubmissionPaths()
    }

    initialize(conf) {
        global.G_uploader_trns = this.uploader_keyed
        global.G_demo_submit_trns = this.demo_submission_keyed
        global.G_publication_submit_trns = this.pub_submission_keyed
        global.G_configurable_submit_trns = this.config_submission_keyed
        this.config_submission_keyed.initialize(conf)
    }
}

module.exports = new MediaUpCustomTransitions()