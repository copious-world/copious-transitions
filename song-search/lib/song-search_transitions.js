
const TaggedTransition = require.main.require('./lib/tagged_transitions')
const uuid = require('uuid/v4')


// Contact Paths
class SpotifySearcherPaths extends TaggedTransition {
    constructor() {
        super("spotify-searcher")
        this.addModule('search-results')
    }
    //
    file_entry_id(file_key) {
        return("")
    }
}

/*
const FETCH_SERVER_WRAPPER_KEY =  'static/key_wrapper_pub_key'
const RESTORE_KEY_FROM_SERVER = `guarded/static/`
const REQ_AUDIO_SESSION_TRANSFER = 'guarded/dynamic/audio-session-transfer'
*/
/*
const SEND_WRAPPED_RECORDING_KEY = 'transition/recording-key'
const SESSION_DEVICE_MOVE = `transition/move_waves`
// WORKER
const STORE_ASSET_POST_URL = `transition/store_waves`
// WSS
const CHUNK_POST_COM_REQ = `transition/hash_progress_com_wss_url`
*/

// RecoringKey Paths
class RecoringKeyPaths extends TaggedTransition {
    constructor() {
        super("recording-key")
        this.addModule('recording-key')
    }
    //
    file_entry_id(file_key) {
        return("")
    }
}

// WaveStore Paths
class WaveStorePaths extends TaggedTransition {
    constructor() {
        super("store_waves")
    }
    //
    file_entry_id(file_key) {
        return("")
    }
}

// Contact Paths
class WaveMoverPaths extends TaggedTransition {
    constructor() {
        super("move_waves")
    }
    //
    file_entry_id(file_key) {
        return("")
    }
}

/*
    'chunk'
    'chunk-final'
    'chunk-change'
*/


class WSS_ChunkPaths extends TaggedTransition {
    constructor() {
        super("chunk")
    }
}


class WSS_ChunkFinalPaths extends TaggedTransition {
    constructor() {
        super("chunk-final")
    }
}


class WSS_ChunkChangePaths extends TaggedTransition {
    constructor() {
        super("chunk-change")
    }
}



//hash_progress_com_wss_url

class SongSearchTransitions {
    constructor() {
        this.searcher_keyed = new SpotifySearcherPaths()        // first app
        //
        // apps for recorder.html
        this.recording_key_keyed = new RecoringKeyPaths()
        this.wave_store_keyed = new WaveStorePaths()
        this.wave_mover_keyed = new WaveMoverPaths()
        //
        this.chunk_keyed = new WSS_ChunkPaths()
        this.chunk_change_keyed = new WSS_ChunkFinalPaths()
        this.chunk_final_keyed = new WSS_ChunkChangePaths()
    }

    initialize() {
        global.G_spotify_searcher_trns = this.searcher_keyed
        //
        global.G_recording_key_injest_trns = this.recording_key_keyed
        global.G_wave_store_trns = this.wave_store_keyed
        global.G_wave_mover_trns = this.wave_mover_keyed
        //
        global.G_wss_chunk = this.chunk_keyed
        global.G_wss_chunk_final = this.chunk_change_keyed
        global.G_wss_chunk_change = this.chunk_final_keyed
        //
    }
    
}

module.exports = new SongSearchTransitions()