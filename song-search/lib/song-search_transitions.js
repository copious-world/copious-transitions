
const TaggedTransition = require("lib/tagged_transitions")
const uuid = require('uuid/v4')


// Contact Paths
class SpotifySearcherPaths extends TaggedTransition {
    constructor() {
        super("spotify-searcher")
    }
    //

    file_entry_id(file_key) {
        return("")
    }
}

class SongSearchTransitions {
    constructor() {
        this.searcher_keyed = new SpotifySearcherPaths()
    }

    initialize() {
        global.G_spotify_searcher_trns = this.searcher_keyed
    }
    
}

module.exports = new SongSearchTransitions()