#!/usr/bin/env node

const CopiousTransitions = require('../user_service_class')


let [config,debug] = [false,false]

// behavior and modules defined in use-service.conf are very influential.
// There is one file included in the npm package that configures a very basic
// web page environment. Check out the copious-transition-apps for more far reaching 
// applications

config = "./user-service.conf"
if ( process.argv[2] !== undefined ) {
    config = process.argv[2];
}


// The application will enter into debug mode if the "debug" token
// is at the end of the command line

if (  process.argv[3] !== undefined ) {
    if ( process.argv[3] === 'debug' ) {
        debug = true
    }
}

// Runs the apps after loading modules and setting up DB connections
// with the values established by the configuration file.
let transition_app = new CopiousTransitions(config,debug,__dirname)


// The ready event progagates back from remote connections and
// other api setups. The 'run' method will start the server "listening" 
// for connections.
transition_app.on('ready',async () => {
    await transition_app.run()
})
