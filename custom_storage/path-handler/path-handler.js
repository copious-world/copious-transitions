'use strict';
const {EventEmitter} = require('events')
//
//
const EMAIL_PATH = 'app_email'
const USER_PATH = 'user'
const CONTACT_PATH = 'contact'
const PERSISTENCE_PATH = 'persistence'
const NOTIFICATION_PATH = 'notify'


class PathHandler extends EventEmitter {

    constructor(path,conf,FanoutRelayerClass) {
        super()
        this.path = path
        this.conf = conf
        this.message_relayer = false
        this.RelayerClass = FanoutRelayerClass
        this.init(conf)
    }

    init(conf) {
        this.message_relayer = new this.RelayerClass(conf.relay)
    }

    async send(message) {
        let response = await this.message_relayer.sendMessage(message)
        return response
    }

    async get(message) {
        let op_message = {
            "op" : "G",
            "param" : message
        }
        let response = await this.message_relayer.sendMessage(op_message)
        return response
    }

    async del(message) {
        let op_message = {
            "op" : "D",
            "param" : message
        }
        let response = await this.message_relayer.sendMessage(op_message)
        return response
    }


    subscribe(topic,msg,handler) {
        msg.topic = topic     // just a double check on making sure that required fields are present
        msg.ps_op = 'sub'
        this.message_relayer.on('update',handler)       // add another event listener
        this.send(msg)
    }

    request_cleanup(handler) {
        this.message_relayer.removeListener('update',handler)
    }
}


class OutgoingEmailHandler extends PathHandler {
    constructor(conf,FanoutRelayerClass) {
        super(EMAIL_PATH,conf,FanoutRelayerClass)
    }
    //
    init(conf) {
        super.init(conf)
    }

    del(message) { return("none") }
    get(message) { return("none") }
}


class ContactHandler extends PathHandler {
    constructor(conf,FanoutRelayerClass) {
        super(CONTACT_PATH,conf,FanoutRelayerClass)
    }
    //
    init(conf) {
        super.init(conf)
    }

    del(message) {return("none")  }
    get(message) { return("none") }

}


class UserHandler extends PathHandler {
    constructor(conf,FanoutRelayerClass) {
        super(USER_PATH,conf,FanoutRelayerClass)
    }
    //
    init(conf) {
        super.init(conf)
    }

    del(message) { return("none") }
}




class PersistenceHandler extends PathHandler {
    constructor(conf,FanoutRelayerClass) {
        super(PERSISTENCE_PATH,conf,FanoutRelayerClass)
    }
    //
    init(conf) {
        super.init(conf)
        if ( conf.listeners ) {
            conf.listeners.forEach(listener => {
                // most likely stick things in the local database
                this.message_relayer.on('update_string',listener.strings)
                this.message_relayer.on('update',listener.objects)
            })
        }
    }
}


class NotificationHandler extends PathHandler {
    constructor(conf,FanoutRelayerClass) {
        super(NOTIFICATION_PATH,conf,FanoutRelayerClass)
    }
    //
    init(conf) {
        super.init(conf)
        if ( conf.listeners ) {
            conf.listeners.forEach(listener => {
                // most likely stick things in the local database
                this.message_relayer.on('update_string',listener.strings)
                this.message_relayer.on('update',listener.objects)
            })
        }
    }
}

const g_path_classes = {
    'app_email' : OutgoingEmailHandler,
    'user' : UserHandler,
    'contact' : ContactHandler,
    'persistence' : PersistenceHandler,
    'notify' : NotificationHandler
}

const g_path_impls = {
    'app_email' : null,
    'user' : null,
    'contact' : null,
    'persistence' : null,
    'notify' : null
}

function Path_handler_factory(path,path_conf,FanoutRelayerClass) {
    let PathClass = g_path_classes[path]
    if ( PathClass !== undefined ) {
        let pc = new PathClass(path_conf,FanoutRelayerClass)
        g_path_impls[path] = pc
        return(pc)
    }
    let pc = new PathHandler(path_conf,FanoutRelayerClass)
    g_path_impls[path] = pc
    return pc
}


module.exports = Path_handler_factory;
