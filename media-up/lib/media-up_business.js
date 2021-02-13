const {MessageRelayer} = require("message-relay-services")
const GeneralBusiness = require.main.require('./lib/general_business')
const ReMailer = require.main.require("./lib/remailer");

const myStorageClass = null
const apiKeys = require.main.require('./local/api_keys')


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
    <a href="http://www.copious.world">copious.world login</a>
  `,
    "from": '"noreply" <noreply@noreply.com>', // sender address
    "to": "", // list of receivers
    "subject": "Your copious.world BB account is now active", // Subject line
    "text": "You can log into your account at: http://www.copious.world", // plain text body
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
    <a href="http://www.copious.world">copious.world login</a>
  `,
    "from": '"noreply" <noreply@noreply.com>', // sender address
    "to": "", // list of receivers
    "subject": "Your copious.world BB account is now active", // Subject line
    "text": "You can log into your account at: http://www.copious.world", // plain text body
}



class UploaderBusiness extends GeneralBusiness {
    //
    constructor() {
        super()
        this.db = null
        this.rules = null
        this.mail_transport = null
        this.mail_to_upload_user = null
        this.mail_to_song_of_day_user = null
    }

    //
    initialize(conf_obj,db) {
        this.db = db
        this.rules = conf_obj.business ? ( conf_obj.business.rules ? conf_obj.business.rules : null ) : null
        this.initialize_mailing()
    }

    initialize_mailing() {
        this.mail_transport = new MessageRelayer(apiKeys.message_relays);
        this.mail_to_upload_user = new ReMailer(this.mail_transport,uploader_props);
        this.mail_to_song_of_day_user = new ReMailer(this.mail_transport,songofday_submitter_props);
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
            case "demo" : {
                if ( this.mail_to_upload_user ) {
                    if ( body.category === "singer-demo" ) {
                        let [html,text] = this.helper_populate_message(post_body,this.mail_to_upload_user.html, this.mail_to_upload_user.text)
                        this.mail_to_upload_user.html = html
                        this.mail_to_upload_user.text = text
                        this.mail_to_upload_user.emit('email_this',post_body.email)
                    }
                }            
                break
            }
            case "submitter" : {
                if ( this.mail_to_song_of_day_user ) {
                    if ( body.category ===  "song-of-the-day" ) {
                        let [html,text] = this.helper_populate_message(post_body,this.mail_to_song_of_day_user.html, this.mail_to_song_of_day_user.text)
                        this.mail_to_song_of_day_user.html = html
                        this.mail_to_song_of_day_user.text = text
                        this.mail_to_song_of_day_user.emit('email_this',post_body.email)
                    }
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
