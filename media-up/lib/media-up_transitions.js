
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
}

class PubSubmissionPaths extends MediaSubmitTransition {
    constructor() {
        super("do_publication_upload")
    }

    file_entry_id(file_key) {
        return('_' + file_key + '_soday')
    }
}


class MediaUpCustomTransitions {
    constructor() {
        this.uploader_keyed = new UploaderPaths()
        this.demo_submission_keyed = new DemoSubmissionPaths()
        this.pub_submission_keyed = new PubSubmissionPaths()
    }

    initialize() {
        global.G_uploader_trns = this.uploader_keyed
        global.G_demo_submit_trns = this.demo_submission_keyed
        global.G_publication_submit_trns = this.pub_submission_keyed
    }
}

module.exports = new MediaUpCustomTransitions()