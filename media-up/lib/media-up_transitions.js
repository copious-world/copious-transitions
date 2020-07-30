
const TaggedTransition = require("lib/tagged_transitions")
const uuid = require('uuid/v4')

// Contact Paths
class UploaderPaths extends TaggedTransition {
    constructor() {
        super("upload")
        this.static_entries = ["singer-uploader", "songofday-uploader" ]
    }
    //
    transform_file_name(file_name) {
        return(file_name.replace('.','_'))
    }

    file_entry_id(file_key) {
        return("")
    }
}

class SingerSubmissionPaths extends TaggedTransition {
    constructor() {
        super("do_singer_upload")
    }
}

class SongSubmissionPaths extends TaggedTransition {
    constructor() {
        super("do_song_of_day_upload")
    }
}


class MediaUpCustomTransitions {
    constructor() {
        this.uploader_keyed = new UploaderPaths()
        this.singer_submission_keyed = new SingerSubmissionPaths()
        this.song_submission_keyed = new SongSubmissionPaths()
    }

    initialize() {
        global.G_uploader_trns = this.uploader_keyed
        global.G_singer_submit_trns = this.singer_submission_keyed
        global.G_song_submit_trns = this.song_submission_keyed
    }
    
}

module.exports = new MediaUpCustomTransitions()