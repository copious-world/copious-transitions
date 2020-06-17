const GeneralBusiness = require('lib/general_business')
const nodemailer = require("nodemailer");
const ReMailer =  = require("lib/remailer");
//const myStorageClass = null

const apiKeys = require('local/aipkeys')

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
    "html" :    ` Thank you for joining our community.
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
    "html" :    `Please follow the link below to update your password.
    <br>
    This email has been sent to you just to let you know that your user account is ready for you to log in.
    <br>
    <b>You can log into your account at:</b>
    <a href="http://www.copious.world/new_password/$$whokey">password update for $$who </a>
    `,
    "from": '"noreply" <noreply@noreply.com>', // sender address
    "to": "", // list of receivers
    "subject": "Reset your account password", // Subject line
    "text": "Please surf to: http://www.copious.world/new_password/$$whokey", // plain text body
}


var g_MailToNewUser = new ReMailer(g_mail_transport,new_user_props);
var g_MailToForgetfulUser = new ReMailer(g_mail_transport,forgetful_user_props);




class CaptchaBusines extends GeneralBusiness {
    //
    constructor() {
        //super(myStorageClass)
        this.db = null
        this.rules = null
    }

    //
    process(use_case,post_body) {
        switch ( use_case ) {
            case "forgot" : {
                if ( g_MailToForgetfulUser ) {
                    let email = post_body.email
                    let whokey = do_hash(post_body.email)
                    let html = g_MailToForgetfulUser.html
                    html = html.replace("$$who",email)
                    html =  html.replace("$$whokey",whokey)
                    g_MailToForgetfulUser.html = html
                    let text = g_MailToForgetfulUser.text
                    text = text.replace("$$who",email)
                    text =  text.replace("$$whokey",whokey)
                    g_MailToForgetfulUser.text = text
                    g_MailToForgetfulUser.emit('email_this',post_body.email)
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

}

    

module.exports = new CaptchaBusines()
