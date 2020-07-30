const GeneralStatic = require('lib/general_static')

const myStorageClass = null

class SongSearchStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
    }

    constructor() {
        super(myStorageClass)
        //
        this.preloaded = {
            "song_of_day" : { "fname" :__dirname + '/song_of_day.json', "ftype" : "json" }
        }
        //
        this.song_of_day_info_asset_media_object = null
    }

    preloaded_all(conf) {
        //
        super.preloaded_all()
        //
        let data = this.preloaded.uploader.data
        let json = this.prepare_asset(data)
        //
        // C) SONG OF DAY INFO (FOR DISPLAY)
        json = this.preloaded.song_of_day_info.data
        //
        this.song_of_day_info_asset_media_object = {
            "mime_type" : "application/json",
            "string" : JSON.stringify(json)
        }

        let intervalRef = setInterval(() => { 
            let json = this.reload(); 
            this.song_of_day_info_asset_media_object.string = JSON.stringify(json) 
        },conf.song_of_day_interval)

        this.intervalRefs.push(intervalRef)
        
    }

    fetch(asset) {
        if ( asset == "song_of_day_info" ) {
            if ( !(this.song_of_day_info_asset_media_object) ) {
                return("empty")
            } else {
                return(this.song_of_day_info_asset_media_object)
            }
        } else {
            return(super.fetch())
        }
    }
}


module.exports = new SongSearchStatic()
