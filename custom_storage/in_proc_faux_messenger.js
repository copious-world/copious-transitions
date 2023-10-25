
// This is a standin for a remote messenger
// Given a remote process is supposed to store data objects,
// this stores those in  a local map (a redundant one)
// The pub/sub methods are noops.

class FauxInMemStore {

    constructor() {
        this._local_map = {}
    }

    set_on_path(msg,m_path) {
        if (  msg._id ) {
            this._local_map[msg._id] = msg
        }
    }

    get_on_path(msg,m_path) {
        if (  msg._id ) {
            return this._local_map[msg._id]
        }
    }

    del_on_path(msg,m_path) {
        if (  msg._id ) {
            delete this._local_map[msg._id]
        }
    }

    subscribe(topic,msg,topic_handler) {
        // pointless
    }

    publish(topic,obj) {
        // pointless
    }

}


module.exports = FauxInMemStore
