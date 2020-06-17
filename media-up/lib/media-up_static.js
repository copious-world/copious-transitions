const GeneralStatic = require('lib/general_static')

const myStorageClass = null

class MediaUpStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
        //
        this.preloaded = {
            "uploader" : { "fname" :__dirname + '/uploader.html', "ftype" : "html" },
            "song_submit" : { "fname" :__dirname + '/submitter.html', "ftype" : "html" },
            "song_of_day" : { "fname" :__dirname + '/song_of_day.json', "ftype" : "json" }
        }
        //
        this.singer_asset_media_object = null
        this.songofday_asset_media_object = null
    }

    preloaded_all(conf) {
        //
        super.preloaded_all()
        //
        // A) SINGER UPLOAD FORM
        let data = this.preloaded.uploader.data
        let json = this.prepare_asset(data)
        //
        this.singer_asset_media_object = {
            "mime_type" : "appliation/json",
            "string" : JSON.stringify(json)
        }
        //
        // B) SONG OF DAY SUBMISSION FORM
        data = this.preloaded.song_submit.data
        json = this.prepare_asset(data)
        //
        this.songofday_asset_media_object = {
            "mime_type" : "application/json",
            "string" : JSON.stringify(json)
        }
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
        if ( asset == "singer-uploader" ) {
            if ( !(this.singer_asset_media_object) ) {
                return("empty")
            } else {
                return(this.singer_asset_media_object)
            }
        } else if ( asset == "songofday-uploader" ) {
            if ( !(this.songofday_asset_media_object) ) {
                return("empty")
            } else {
                return(this.songofday_asset_media_object)
            }
        } else if ( asset == "song_of_day_info" ) {
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


module.exports = new MediaUpStatic()
