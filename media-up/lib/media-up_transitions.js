
const TaggedTransition = require("lib/tagged_transitions")
const uuid = require('uuid/v4')

// Contact Paths
class UploaderPaths extends TaggedTransition {
    constructor() {
        super("upload")
    }
    //
    transform_file_name(file_name) {
        return(file_name.replace('.','_'))
    }

    file_entry_id(file_key) {
        return("")
    }
}
w
class MediaUpCustomTransitions {
    constructor() {
        this.uploader_keyed = new UploaderPaths()
    }

    initialize() {
        global.G_uploader_trns = this.uploader_keyed
    }
    
}

module.exports = new MediaUpCustomTransitions()