const url = require('url')
const express     = require('express');
const app         = express();
const fs          = require('fs');



g_streamer_port = process.argv[2]  ?  process.argv[2] :  2011

const gc_song_of_day_info = `${__dirname}/sites/popsong/song_of_day.json`

/*
location /mp3/ {
    root data;
    mp4;
    mp4_buffer_size      1m;
    mp4_max_buffer_size  5m;
 }
*/

var g_play_counter = {
  'count' : 0,
  'song' : '',
  'title' : '',
  'date' : Date.now()
}

const SONG_OF_DAY_UPDATE_INTERVAL =  60000

var g_waiting_for_midnight = false
function pastMidNight() {
  let d = new Date()
  let h = d.getHours()
  if ( h == 23 ) {
    g_waiting_for_midnight = true
  } else {
    if ( ( h == 0 ) && g_waiting_for_midnight ) {
      g_waiting_for_midnight = false
      return true
    }
  }
  return(false)
}

function update_play_count() {
  //
  fs.readFile(gc_song_of_day_info,(err,data) => {
    //
    if ( !err ) {
      let song_of_day_info = null
      //
      try {
        song_of_day_info = JSON.parse(data.toString())
      } catch ( e ) {
        console.error(e)
        return
      }
      let file = __dirname + '/play_count.json';
      fs.readFile(file,(err2,data2) => {
        if ( !err2 ) {
          let counters = JSON.parse(data2.toString())
          counters[counters.length-1] = g_play_counter
          //
          if ( (song_of_day_info.title !== g_play_counter.title) || pastMidNight() ) {
            g_play_counter = {
              'count' : 0,
              'song' : JSON.stringify(song_of_day_info),
              'title' : song_of_day_info.title,
              'date' : Date.now()
            }
            counters.push(g_play_counter)
          }
          //
          fs.writeFile(file,JSON.stringify(counters),(err3) => {
            if ( err3 ) {
              console.log(err3)
            }
          })
        } else {
          console.log(err2)
        }
      })
    } else {
      console.log(err)
    }
    //
  })
}


function init_play_count(cb) {
  let file = __dirname + '/play_count.json';
  console.log("init play count: " + file)
  fs.access(file, fs.constants.F_OK, (err) => {
    if ( !err ) {
      console.log("play count read")
      let counters = JSON.parse(fs.readFileSync(file,'ascii').toString())
      g_play_counter = counters[counters.length-1]
      if ( cb ) cb()
    } else {
      console.log("create play count")
      fs.readFile(gc_song_of_day_info,(err,data) => {
        if ( !err ) {
          try {
            let song_of_day_info = JSON.parse(data.toString())
            g_play_counter.song = JSON.stringify(song_of_day_info)
            g_play_counter.title = song_of_day_info.title
            fs.writeFileSync(file,'[' + JSON.stringify(g_play_counter) + ']')
            if ( cb ) cb()
          } catch(e) {
            console.error(e)
          }
        } else {
          console.log("could not find the song of the day")
          process.exit(1)
        }
      })
    }
  });
}

function play_count() {
  g_play_counter.count++
}


// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------

init_play_count(() => {
  setInterval(update_play_count,SONG_OF_DAY_UPDATE_INTERVAL)
})
// streamer-day_info

var g_media_extension = ['.ogg','.mp3','.txt']


app.get('/', (req, res) => {
  console.log(req.headers.host)
  res.end('system check')
})

app.get('/streamoftheday', (req, res) => {
  //
  //console.log(req.headers.host)
  //console.dir(req.headers)
  //
  if ( (req.headers.host === 'localhost') || ( req.headers.host.indexOf('popsongnow.com') >= 0 ) ) {
    console.log("hello " + req.url)
    let media_extensions = [].concat(g_media_extension)
    while ( media_extensions.length > 0 ) {
      let media_extension = media_extensions.shift()
      let filename = req.url.toString()
      try {
        let fname = filename + media_extension
        let stat = fs.statSync(__dirname + fname)
        play_count()
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': stat.size
        });
        // We replaced all the event handlers with a simple call to util.pump()
        fs.createReadStream(__dirname + fname,{start:0}).pipe(res);
        return(true)
      } catch (e) {
        if ( !(media_extensions.length) ) {
          console.log(e)
        }
      }
      //
      //
    }

  }

  res.writeHead(301, {Location: 'http://www.popsongnow.com/'} );
  res.end();
  return(false)
})


/*
http.createServer((req, res) => {
    if ( (req.headers.referer === 'https://localhost/') || (req.headers.referer === 'http://popsongnow.com/') ) {
        //
        const skip = typeof(queryData.skip) == 'undefined' ? 0 : queryData.skip;
        //
        let filename = req.url.toString()
        //
        let media_extensions = [].concat(g_media_extension)
        //
        while ( media_extensions.length > 0 ) {
            let media_extension = media_extensions.shift()
            try {
                let fname = filename + media_extension
                let stat = fs.statSync(__dirname + fname)
                const startByte = stat.size * skip;
                if ( skip === 0 ) {
                  play_count()
                }
                //
                res.writeHead(200, {
                    'Content-Type': 'audio/mpeg',
                    'Content-Length': stat.size - startByte
                });
                // We replaced all the event handlers with a simple call to util.pump()
                fs.createReadStream(__dirname + fname, {start:startByte}).pipe(res);
                return(true)
            } catch (e) {
                if ( !(media_extensions.length) ) {
                    console.log(e)
                    res.writeHead(301, {Location: 'http://www.popsongnow.com/'} );
                    res.end();
                    return(false)  
                }
            }
        }

        //
    }
    //
})
.listen(2011);

*/


app.get('/play/:key', (req, res) => {
  var key = req.params.key;

  var music = 'music/' + key + '.mp3';

  var stat = fs.statSync(music);
  range = req.headers.range;
  var readStream;

  if (range !== undefined) {
      var parts = range.replace(/bytes=/, "").split("-");

      var partial_start = parts[0];
      var partial_end = parts[1];

      if ((isNaN(partial_start) && partial_start.length > 1) || (isNaN(partial_end) && partial_end.length > 1)) {
          return res.sendStatus(500); //ERR_INCOMPLETE_CHUNKED_ENCODING
      }

      var start = parseInt(partial_start, 10);
      var end = partial_end ? parseInt(partial_end, 10) : stat.size - 1;
      var content_length = (end - start) + 1;

      res.status(206).header({
          'Content-Type': 'audio/mpeg',
          'Content-Length': content_length,
          'Content-Range': "bytes " + start + "-" + end + "/" + stat.size
      });

      readStream = fs.createReadStream(music, {start: start, end: end});
  } else {
      res.header({
          'Content-Type': 'audio/mpeg',
          'Content-Length': stat.size
      });
      readStream = fs.createReadStream(music);
  }
  readStream.pipe(res);
});




app.listen(g_streamer_port, function() {
  console.log(`[NodeJS] Application Listening on Port ${g_streamer_port}`);
});


