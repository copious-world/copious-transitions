const GeneralBusiness = require.main.require('./lib/general_business')
const ReMailer = require.main.require("./lib/remailer");
const apiKeys = require.main.require('./local/api_keys')
//
const {MessageRelayer} = require("message-relay-services")


const new_user_props = {
    "html" : `Thank you for joining our community.
    <br>
    This email has been sent to you just to let you know that your user account is ready for you to log in.
    <br>
    <b>You can log into your account on the main page at:</b>
    <a href="http://www.copious.world/">copious.world login</a>
    `,
    "from": '"noreply" <noreply@noreply.com>', // sender address
    "to": "", // list of receivers
    "subject": "Your copious.world BB account is now active", // Subject line
    "text": "You can log into your account at: http://www.copious.world", // plain text body

}


class CaptchaBusines extends GeneralBusiness {
    //
    constructor() {
        super()
        this.db = null
        this.rules = null
        this.mail_transport = null
        this.mail_to_new_user = null
        this.mail_to_forgetful_user = null
    }


    initialize(conf_obj,db) {
        super.initialize(conf_obj,db)
        this.conf = conf_obj
        this.initialize_mailing()
    }

    initialize_mailing() {
        this.mail_transport = new MessageRelayer(apiKeys.message_relays);
        this.mail_to_new_user =  new ReMailer(this.mail_transport,new_user_props);
    }

    //
    process(use_case,post_body) {
        switch ( use_case ) {
            case "new-user" : {
                if (  this.mail_to_new_user ) {
                     this.mail_to_new_user.emit('email_this',post_body.email)
                }            
                break
            }
            default: {
                return false
            }
        }
        return true
    }

    cleanup(transition,pkey,post_body) {
        if ( G_password_reset_trns.tagged(transition) ) {
            this.del_recent_forgetfulness(pkey)
            let whokey = post_body.who
            this.db.del_static_store(whokey)
            let tracking_num = post_body.trackable
            this.db.del_key_value(tracking_num)
        }
    }

// "https://${this.conf.domain}/captcha/transition/password-reset"
// https://${this.conf.domain}>${this.conf.domain}
    get_password_update_form(whokey) {  // put the form into the cached body and return the html page
        let html = `
        <div id="interface-box" >
            <label>Enter the same password you typed into the login page:</label>
            <input type="password" id='password' value='' />
            <input type="hidden" id='who' value='${whokey}' />
            <input type="hidden" id='trackable' value='$$$tracking_num' />
            <input type="hidden" id='post_url' value='https://localhost/captcha/transition/password-reset' >
            <button onclick="post_submit(['password','who','trackable','post_url'])" style="width:70%">update password</button>
        </div>
        <div id="success-box" >
            Your password has been reset. You may now login at <a href='https://localhost'>${this.conf.domain}</a>
        </div>
        <div id="error-box" >
            There was an error while attempting to reset your password. Have you already registerd? 
            <a href='https://${this.conf.domain}'>${this.conf.domain}</a>
        </div>
        `
        let logo_body = this.logo_body
        html = logo_body.replace('$$BODY_INSERT',html)
        return(html)
    }

}

    

module.exports = new CaptchaBusines()
