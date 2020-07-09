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
    <b>You can log into your account on the main page at:</b>
    <a href="http://www.copious.world/">copious.world login</a>
    `,
    "from": '"noreply" <noreply@noreply.com>', // sender address
    "to": "", // list of receivers
    "subject": "Your copious.world BB account is now active", // Subject line
    "text": "You can log into your account at: http://www.copious.world", // plain text body

}


const forgetful_user_props = {
    "html" : `Please follow the link below to update your password.
    <br>
    <a href="https://www.copious.world/captcha/static/$$whokey">password update for $$who </a>
    `,
    "from": '"noreply" <noreply@noreply.com>', // sender address
    "to": "", // list of receivers
    "subject": "Reset your account password", // Subject line
    "text": "Please surf to: https://www.copious.world/captcha/static/$$whokey", // plain text body
}


var g_MailToNewUser = new ReMailer(g_mail_transport,new_user_props);
var g_MailToForgetfulUser = new ReMailer(g_mail_transport,forgetful_user_props);
/*
                    g_MailToForgetfulUser.html = emailer.html
                    g_MailToForgetfulUser.text = emailer.text
*/



class CaptchaBusines extends GeneralBusiness {
    //
    constructor() {
        super()
        this.db = null
        this.rules = null
    }


    initialize(conf_obj,db) {
        super.initialize(conf_obj,db)
        this.conf = conf_obj
    }

    //
    process(use_case,post_body) {
        switch ( use_case ) {
            case "forgot" : {
                if ( g_MailToForgetfulUser ) {
                    let email = post_body.email
                    let emailer = this.get_recently_forgetful(email)        // for repetitions on this pathway
                    let trackable = ""
                    if ( !emailer ) {
                        emailer = { 'count' : 0, 'email' : email, 'html' : '', 'text' : '', 'trackable' : '' }
                        let whokey = do_hash(email + 'FORGETFUL' + this.forgetfulness_tag)
                        //  HTML
                        let html = g_MailToForgetfulUser.html
                        html = html.replace("$$who",email)
                        html =  html.replace("$$whokey",whokey)
                        emailer.html = html     // emailer
                        // TEXT
                        let text = g_MailToForgetfulUser.text
                        text = text.replace("$$who",email)
                        text =  text.replace("$$whokey",whokey)
                        emailer.text = text     // emailer
                        // STORE WHOKEY IN KEY VALUE
                        trackable = this.get_password_update_form(whokey)  // made the whokey once ... generated once
                        emailer.trackable = trackable
                        this.store_recent_forgetfulness(email,emailer)  // store for later repetitions for a while.
                    } else {
                        trackable = emailer.trackable
                    }
                    //
                    emailer.count++
                    // new tracking number each time
                    let tracking_num = do_hash(whokey + 'A' + emailer.count + 'B' + ((11*emailer.count - 3)%13)) // just some weird thing
                    let viewable = trackable.replace("$$tracking_num",tracking_num)
                    // send the email with the link to the form that is being updated here
                    g_MailToForgetfulUser.emit('email_this',emailer.email,emailer)
                    //
                    // update this form and store it.  // this will be sent... when the user clicks the link in his email
                    this.db.put_static_store(whokey,viewable,'text/html')   // the whokey points to the web page that will be displayed (key,asset)
                    //
                    this.db.del_key_value(tracking_num) // no buildup of tracking numbers
                    emailer.tracking_num = tracking_num // save for next time (it is stored by this class or parent)
                    this.db.set_key_value(tracking_num, email)  // information that links the user to the reset password
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

    cleanup(transition,pkey,post_body) {
        if ( G_password_reset_trns.tagged(transition) ) {
            this.del_recent_forgetfulness(pkey)
            let whokey = post_body.who
            this.db.del_static_store(whokey)
            let tracking_num = post_body.trackable
            this.db.del_key_value(tracking_num)
        }
    }


    get_password_update_form(whokey) {  // put the form into the cached body and return the html page
        let html = `
        <div id="interface-box" >
        <form method='POST' action="https://${this.conf.domain}/captcha/transition/password-reset" >
            <input type="hidden" name='tracking' value='$$tracking' />
            <div>
                <label>Enter the same password you typed into the login page:</label>
                <input type="password" id='password' value='' />
                <input type="hidden" id='who' value='${whokey}' />
                <input type="hidden" id='trackable' value='$$tracking_num' />
                <input type="hidden" id='post_url' value='https://${this.conf.domain}/captcha/transition/password-reset' >
            </div>
            <button onclick="post_submit(['password','who','trackable'])" />
        </form>
        </div>
        <div id="success-box" >
            Your password has been reset. You may now login at <a href='https://${this.conf.domain}">${this.conf.domain}</a>
        </div>
        <div id="error-box" >
            There was an error while attempting to reset your password. Have you already registerd? <a href='https://${this.conf.domain}">${this.conf.domain}</a>
        </div>
        `
        let logo_body = this.logo_body
        html = logo_body.replace('$$BODY_INSERT',html)
        return(html)
    }

}

    

module.exports = new CaptchaBusines()
