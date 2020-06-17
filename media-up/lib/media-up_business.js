//const GeneralStatic = require('lib/general_static')

const nodemailer = require("nodemailer");
const ReMailer = require("lib/remailer");

const myStorageClass = null

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


const uploader_props = {
    "html" :  ` Thank you for sending us your voice demo.
    <br>
    If this is the first time you have sent a demo, then be sure that your demo will only be used 
    for evaluation by this site. It will not be forwarded in anyway to any other angency. 
    <br>
    If someone here thinks that you might he helped by sending it to another agency, then we will contact you by email.
    We have not take your phone number.
    <br>
    After a while, the demo will be discarded. This may be a matter of months. So, keep in mind 
    this does not store youre demo and provide access to it. 
    <br>
    You may change your demo by uploading it again at the same email address. As as a result of doing so,
    a demo for you will stay in our system longer. But, a new demo will overwrite the old one. One reason to 
    overwrite your old demo would be if you found a way to improve your first demo.
    <br>
    Because you uploaded a demo, we have given you a courtesy user account.
    Username: $$who
    Password: $$password
    <br>
    Login and change your password. You may make a bio page as well.
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



const songofday_submitter_props = {
    "html" :  ` Thank you for your 'song of the day' submission.
    <br>
    Because you uploaded a song, we have given you a courtesy user account.
    Username: $$who
    Password: $$password
    <br>
    Login and change your password. You may make a bio page as well.
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



var g_MailToUploader = new ReMailer(g_mail_transport,uploader_props);
var g_MailToSODSubmittter = new ReMailer(g_mail_transport,songofday_submitter_props);



class UploaderBusiness {
    //
    constructor() {
        //super(myStorageClass)
        this.db = null
        this.rules = null
    }

    //
    initialize(conf_obj,db) {
        this.db = db
        this.rules = conf_obj.business ? ( conf_obj.business.rules ? conf_obj.business.rules : null ) : null
    }

    //
    helper_populate_message(post_body,html,text) {
        let email = post_body.email
        let whokey = do_hash(post_body.email)
        html = html.replace("$$who",email)
        html =  html.replace("$$password",post_body.password)
        text = text.replace("$$who",email)
        text =  text.replace("$$password",post_body.password)
        return [html,text]
    }

    //
    process(use_case,post_body) {
        switch ( use_case ) {
            case "upload" : {
                if ( g_MailToUploader ) {
                    let [html,text] = this.helper_populate_message(post_body,g_MailToUploader.html, g_MailToUploader.text)
                    g_MailToUploader.html = html
                    g_MailToUploader.text = text
                    g_MailToUploader.emit('email_this',post_body.email)
                }            
                break
            }
            case "submitter" : {
                if ( g_MailToSODSubmittter ) {
                    let [html,text] = this.helper_populate_message(post_body,g_MailToSODSubmittter.html, g_MailToSODSubmittter.text)
                    g_MailToSODSubmittter.html = html
                    g_MailToSODSubmittter.text = text
                    g_MailToSODSubmittter.emit('email_this',post_body.email)
                }
                break
            }
            default: {
                break
            }
        }
    }

}

    

module.exports = new UploaderBusiness()
