
const {ServeMessageEndpoint} = require("message-relay-services")
const fsPromises = require('fs/promises')
//
const {asset_generator} = require('./generate_user_assets')

// Parent class handles publication 


class UserMessageEndpoint extends ServeMessageEndpoint {

    constructor(conf) {
        super(conf)
        this.user_directory = conf.user_directory
        this._type_directories = [ "blog", "stream", "demo", "assets", "ownership", "notify" ]
        this.all_users = conf.all_users
        this.template_dir = conf.asset_template_dir
        this._gen_targets = conf._gen_targets
        this.create_OK = true

        console.log(process.cwd())
    }


    make_path(u_obj) {
        let user_id = u_obj._id
                    // password is a hash of the password, might encrypt it... (also might carry other info to the back..)
        let user_path = `${this.all_users}/${user_id}_${u_obj.password}.json`
        return(user_path)
    }
    //
    async ensure_directories(user_id) {
        let upath = this.user_directory + '/' + user_id
        try {
            await fsPromises.mkdir(upath)
        } catch(e) {
            if ( e.code !== 'EEXIST') console.error(e)
        }

        for ( let dr of this._type_directories ) {
            let subdr = upath + '/' + dr
            try {
                await fsPromises.mkdir(subdr)
            } catch(e)  {
                if ( e.code !== 'EEXIST') console.error(e)
            }
        }
    }


    async create_user_assets(msg_obj) {
        let user_id = msg_obj._id
        let assets_dir = `${this.user_directory}/${user_id}`
        // assumes that the assets directories have been created
        let dir_paths = {
            "base" : assets_dir.substr(1)  // no '.' at front
        }
        msg_obj.dir_paths = dir_paths
        await asset_generator(this.template_dir,assets_dir,msg_obj,this._gen_targets)
    }


    //
    async create_entry_type(msg_obj) {  // to the user's directory
        try {
            let user_path = this.make_path(msg_obj)
            if ( !(user_path) ) return "ERR"
console.log(`create_entry_type  ${user_path}`)
            await fsPromises.writeFile(user_path,(JSON.stringify(msg_obj)),{ 'flag' : 'wx' })
            return "OK"
        } catch(e) {
            console.log(e)
            return "ERR"
        }
    }

    //
    async load_data(msg_obj) {
        try {
            let user_path = this.make_path(msg_obj)
            if ( !(user_path) ) return "ERR"
console.log(`load_data  ${user_path}`)
            let data = await fsPromises.readFile(user_path)
            return(data.toString())
        } catch (e) {
            console.log(">>-------------update read------------------------")
            console.log(e)
            console.dir(msg_obj)
            console.log("<<-------------------------------------")
        }
        return false
    }


    //
    async update_entry_type(msg_obj) {
        try {
            let user_path = this.make_path(msg_obj)
            if ( !(user_path) ) return "ERR"
            let data = await fsPromises.readFile(user_path)
            try {
                let u_obj = JSON.parse(data.toString())
                for ( let ky in msg_obj ) {
                    if ( ky === '_id' ) continue;
                    u_obj[ky] = msg_obj[ky]
                }
console.log(`load_data  ${user_path}`)
                await fsPromises.writeFile(user_path,JSON.stringify(u_obj))
                return "OK"
            } catch (e) {
                console.log(">>-------------update parse data------------------------")
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


    //
    async app_message_handler(msg_obj) {
        let op = msg_obj._tx_op
        let result = "OK"
        let user_id = msg_obj._user_dir_key ? msg_obj[msg_obj._user_dir_key] : msg_obj._id
        if ( this.create_OK && !!(user_id) ) {
            await this.ensure_directories(user_id)
        }
        //
        switch ( op ) {
            case 'G' : {        // get user information
                let stat = "OK"
                let data = await this.load_data(msg_obj)
                if ( data === false ) stat = "ERR"
                return({ "status" : stat, "data" : data,  "explain" : "get", "when" : Date.now() })
            }
            case 'D' : {        // delete user from everywhere if all ref counts gones.
                                // don't do this here...
                break
            }
            case 'S' : {  // or send
                let action = msg_obj.user_op
                if ( action === "create" ) {
                    await this.create_user_assets(msg_obj)
                    result = await this.create_entry_type(msg_obj)
                } else if ( action === "update" ) {
                    result = await this.update_entry_type(msg_obj)
                }
                break
            }
            default : {
                break
            }
        }
        //
        return({ "status" : result, "explain" : "op performed", "when" : Date.now() })
    }
}


module.exports = UserMessageEndpoint
