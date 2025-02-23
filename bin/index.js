#!/usr/bin/env node

const CopiousTransitions = require('../user_service_class')


let [config,debug] = [false,false]


config = "./user-service.conf"
if ( process.argv[2] !== undefined ) {
    config = process.argv[2];
}

if (  process.argv[3] !== undefined ) {
    if ( process.argv[3] === 'debug' ) {
        debug = true
    }
}


let transition_app = new CopiousTransitions(config,debug,__dirname)


transition_app.on('ready',() => {
    transition_app.run()
})

