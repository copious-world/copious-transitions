
const {ServeMessageEndpoint} = require("message-relay-services")
const fsPromises = require('fs/promises')
//

// Parent class handles publication 
 
class PersistenceMessageEndpoint extends ServeMessageEndpoint { // the general class forwards publication...

    constructor(conf) {
        super(conf)
        this.user_directory = conf.user_directory
        this._type_directories = {}
        if ( conf.directories ) {
            this._type_directories = Object.assign({},conf.directories)
        }
        this.create_OK = conf.create_OK
        //
        this.ensure_directories('admin')
        this.init_public_directories()
    }

    async ensure_directories(user_id) {
        //
        let upath = this.user_directory + '/' + user_id
        try {
            await fsPromises.mkdir(upath)
        } catch(e) {
            if ( e.code !== 'EEXIST') console.error(e)
        }
        //
        for ( let dr in this._type_directories ) {
            let subdr = upath + '/' + dr
            try {
                await fsPromises.mkdir(subdr)
            } catch(e)  {
                if ( e.code !== 'EEXIST') console.error(e)
            }
        }
        //
    }

    async init_public_directories() {
        //
        for ( let dr in this._type_directories ) {
            let pub_path = this._type_directories[dr]
            try {
                await fsPromises.mkdir(pub_path)
            } catch(e)  {
                if ( e.code !== 'EEXIST') console.error(e)
            }
        }
    }


    async publish(msg_obj) {        // actual pulication... this file becomes available to the general public...
        try {
            let user_id = msg_obj.uid
            let user_path = this.user_directory + '/' + user_id + '/'
            let entry_type = msg_obj.asset_type
            user_path += entry_type + '/' + msg_obj[msg_obj.key_field] + ".json"
    
            let public_path = this._type_directories[entry_type]
            public_path += '/' + msg_obj[msg_obj.key_field] + ".json"
    
            await fsPromises.copyFile(user_path,public_path)
            return "OK"
        } catch(e) {
            console.log(e)
            return "ERR"
        }
    }


    // data coming from a user dashboard, profile, etc.
    async create_entry_type(msg_obj) {  // to the user's directory
        try {
            let user_id = msg_obj.uid
            let entry_type = msg_obj.asset_type
            let user_path = this.user_directory + '/' + user_id + '/'
                        + entry_type + '/' + msg_obj[msg_obj.key_field] + ".json"
            await fsPromises.writeFile(user_path,JSON.stringify(msg_obj))
            return "OK"
        } catch(e) {
            console.log(e)
            return "ERR"
        }
    }

    async load_data(msg_obj) {
        try {
            let user_id = msg_obj.uid
            let entry_type = msg_obj.asset_type
            let user_path = this.user_directory + '/' + user_id + '/'
                            + entry_type + '/' + msg_obj[msg_obj.key_field] + ".json"
            let data = await fsPromises.readFile(user_path)
            return(data.toString())
        } catch (e) {
            console.log(">>-------------update read------------------------")
            console.log(data.toString())
            console.log(e)
            console.dir(msg_obj)
            console.log("<<-------------------------------------")
        }
        return false
    }


    async update_entry_type(msg_obj) {
        try {
            let user_id = msg_obj.uid
            let entry_type = msg_obj.asset_type
            let user_path = this.user_directory + '/' + user_id + '/'
                            + entry_type + '/' + msg_obj[msg_obj.key_field] + ".json"
            let data = await fsPromises.readFile(user_path)
            try {
                let u_obj = JSON.parse(data.toString())
                for ( let ky in msg_obj ) {
                    if ( ky === 'uid' ) continue;
                    u_obj[ky] = msg_obj[ky]
                }
                await fsPromises.writeFile(user_path,JSON.stringify(u_obj))
                return "OK"
            } catch (e) {
                console.log(">>-------------update parse data------------------------")
                console.log(data.toString())
                console.error(e)
                console.dir(msg_obj)
                console.log("<<-------------------------------------")
                return "ERR"
            }
        } catch (e) {
            console.log(">>-------------update read------------------------")
            console.log(e)
            console.dir(msg_obj)
            console.log("<<-------------------------------------")
            return "ERR"
        }
    }

    async delete(msg_obj) {
        // check for some criteria... a sys admin token, a ref count ... replicated, etc.
        try {
            let user_id = msg_obj.uid
            let entry_type = msg_obj.asset_type
            let user_path = this.user_directory + '/' + user_id + '/'
                            + entry_type + '/' + msg_obj[msg_obj.key_field] + ".json"
            //
            await fsPromises.rm(user_path)
            //
            let public_path = this._type_directories[entry_type]
            public_path += '/' + msg_obj[msg_obj.key_field] + ".json"
            //
            await fsPromises.rm(public_path)
            return "OK"
        } catch (e) {
            console.log(">>-------------update read------------------------")
            console.log(data.toString())
            console.log(e)
            console.dir(msg_obj)
            console.log("<<-------------------------------------")
        }
        return "ERR"
    }


    async app_message_handler(msg_obj) {
        let op = msg_obj.op
        let result = "OK"
        let user_id = msg_obj.uid
        if ( this.create_OK ) {
            await this.ensure_directories(user_id)
        }
        switch ( op ) {
            case 'P' : {
                result = await this.publish(msg_obj)
                break
            }
            case 'G' : {        // get user information
                let stat = "OK"
                let data = await this.load_data(msg_obj)
                if ( data === false ) stat = "ERR"
                return({ "status" : stat, "data" : data,  "explain" : "get", "when" : Date.now() })
            }
            case 'D' : {        // delete asset from everywhere if all ref counts to zero. (unpinned)
                result = await this.delete(msg_obj)
                break
            }
            default: {  // or send
                let action = msg_obj.user_op
                if ( action === "create" ) {
                    result = await this.create_entry_type(msg_obj)
                } else if ( action === "update" ) {
                    result = await this.update_entry_type(msg_obj)
                }
            }
        }
        //
        return({ "status" : result, "explain" : `${op} performed`, "when" : Date.now() })
    }
}



module.exports = PersistenceMessageEndpoint
