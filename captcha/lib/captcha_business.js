const GeneralBusiness = require.main.require('./lib/general_business')
const ReMailer = require.main.require("./lib/remailer");
const apiKeys = require.main.require('./local/api_keys')
const nodemailer = require("nodemailer");
//const myStorageClass = null



var g_mail_transport = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: 'apikey', // generated ethereal user
      pass: apiKeys.sendGrid // generated ethereal password
    }
});


const new_user_props = {
    "html" : `Thank you for joining our community.
    <br>
    This email has been sent to you just to let you know that your user account is ready for you to log in.
    <br>
    <b>You can log into your account at:</b>
    <a href="http://www.copious.world:2000">copious.world login</a>
    `,
    "from": '"noreply" <noreply@noreply.com>', // sender address
    "to": "", // list of receivers
    "subject": "Your copious.world BB account is now active", // Subject line
    "text": "You can log into your account at: http://www.copious.world:2000", // plain text body

}


const forgetful_user_props = {
    "html" : `Please follow the link below to update your password.
    <br>
    <a href="http://www.copious.world/static_mime/$$whokey">password update for $$who </a>
    `,
    "from": '"noreply" <noreply@noreply.com>', // sender address
    "to": "", // list of receivers
    "subject": "Reset your account password", // Subject line
    "text": "Please surf to: http://www.copious.world/static_mime/$$whokey", // plain text body
}


var g_MailToNewUser = new ReMailer(g_mail_transport,new_user_props);
var g_MailToForgetfulUser = new ReMailer(g_mail_transport,forgetful_user_props);




class CaptchaBusines extends GeneralBusiness {
    //
    constructor() {
        super()
        this.db = null
        this.rules = null
    }

    //
    process(use_case,post_body) {
        switch ( use_case ) {
            case "forgot" : {
                if ( g_MailToForgetfulUser ) {
                    let email = post_body.email

                    let emailer = this.recently_forgetful[email]
                    let trackable = ""
                    if ( !emailer ) {
                        emailer = { 'count' : 0, 'email' : email }
                        let whokey = do_hash(email + 'FORGETFUL' + this.forgetfulness_tag)
                        //
                        let html = g_MailToForgetfulUser.html
                        html = html.replace("$$who",email)
                        html =  html.replace("$$whokey",whokey)
                        emailer.html = html     // emailer
                        //
                        let text = g_MailToForgetfulUser.text
                        text = text.replace("$$who",email)
                        text =  text.replace("$$whokey",whokey)
                        emailer.text = text     // emailer
                        // STORE WHOKEY IN KEY VALUE
                        trackable = this.get_password_update_form(email,whokey)
                        emailer.trackable = trackable
                        this.store_recent_forgetfulness(email,emailer)
                    } else {
                        trackable = emailer.trackable
                    }
                    //
                    emailer.count++
                    let tracking_num = do_hash(whokey + 'A' + emailer.count + 'B' + ((11*emailer.count - 3)%13)) // just some weird thing
                    let viewable = trackable.replace("$$tracking_num",tracking_num)
                    g_MailToForgetfulUser.html = emailer.html
                    g_MailToForgetfulUser.text = emailer.text
                    g_MailToForgetfulUser.emit('email_this',emailer.email)
                    //
                    this.db.set_key_value(whokey,viewable)
                    this.db.del_key_value(tracking_num) // no buildup of tracking numbers
                    emailer.tracking_num = tracking_num // save for next time
                    this.db.set_key_value(tracking_num,JSON.stringify({ "whokey" : whokey, "email" : email }))
                    //
                }            
                break
            }
            case "new-user" : {
                if ( g_MailToNewUser ) {
                    g_MailToNewUser.emit('email_this',post_body.email)
                }            
                break
            }
            default: {
                break
            }
        }
    }


    get_password_update_form(email,whokey) {
        let html = `
        <form method='POST' action="/transition/password-reset" >
            <input type="hidden" name='tracking' value='$$tracking' />
            <div>
                <label>Enter Password:</label>
                <input type="password" name='password' value='' />
            </div>
            <div>
                <label>Enter Password:</label>
                <input type="password2" name='password-verify' value='' />
            </div>
            <input type="submit" />
        </form>
        `
        let logo_body = this.logo_body
        html = logo_body.replace('$$BODY_INSERT',html)
        return(html)
    }

}

    

module.exports = new CaptchaBusines()
