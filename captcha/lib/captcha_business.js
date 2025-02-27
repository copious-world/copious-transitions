const {GeneralBusiness} = require('../../index')
const ReMailer = require("./remailer");


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




class CaptchaBusines extends GeneralBusiness {
    //
    constructor() {
        super()
        this.db = null
        this.rules = null
        this.mail_to_new_user = null
        this.mail_to_forgetful_user = null
    }


    initialize(conf_obj,db) {
        super.initialize(conf_obj,db)
        this.conf = conf_obj
        this.initialize_mailing()
    }


    seeking_endpoint_paths() {
        return [ "mail" ]
    }

    set_messenger(path,messenger) {
        if ( path === 'mail' ) {
            this.mail_transport = messenger
            this.initialize_mailing()
        }
    }

    
    initialize_mailing() {
        if ( this.mail_transport ) {
            this.mail_to_new_user =  new ReMailer(this.mail_transport,new_user_props);
            this.mail_to_forgetful_user = new ReMailer(this.mail_transport,forgetful_user_props);    
        }
    }

    //
    process(use_case,post_body) {
        switch ( use_case ) {
            case "forgot" : {
                try {
                    if (  this.mail_to_forgetful_user ) {
                        let email = post_body.email
                        let emailer = this.get_recently_forgetful(email)        // for repetitions on this pathway
                        let trackable = ""
                        let whokey  = ""
                        if ( !emailer ) {
                            emailer = { 'count' : 0, 'email' : email, 'html' : '', 'text' : '', 'trackable' : '' }
                            whokey = do_hash(email + 'FORGETFUL' + this.forgetfulness_tag)
                            emailer.whokey = whokey
                            //  HTML
                            let html =  this.mail_to_forgetful_user.html
                            html =  html.replace("$$whokey",whokey)
                            html = html.replace("$$who",email)
                            emailer.html = html     // emailer
                            // TEXT
                            let text =  this.mail_to_forgetful_user.text
                            text =  text.replace("$$whokey",whokey)
                            text = text.replace("$$who",email)
                            emailer.text = text     // emailer
                            // STORE WHOKEY IN KEY VALUE
                            trackable = this.get_password_update_form(whokey)  // made the whokey once ... generated once
                            emailer.trackable = trackable
                            this.store_recent_forgetfulness(email,emailer)  // store for later repetitions for a while.
                        } else {
                            trackable = emailer.trackable
                            whokey = emailer.whokey
                        }
                        //
                        emailer.count++
                        // new tracking number each time
                        let tracking_num = do_hash(whokey + 'A' + emailer.count + 'B' + ((11*emailer.count - 3)%13)) // just some weird thing
                        let viewable = trackable.replace("$$tracking_num",tracking_num).replace("$$tracking_num",tracking_num)
                        // send the email with the link to the form that is being updated here
                         this.mail_to_forgetful_user.emit('email_this',emailer.email,emailer)
                        //
                        // update this form and store it.  // this will be sent... when the user clicks the link in his email
                        this.db.put_static_store(whokey,viewable,'text/html')   // the whokey points to the web page that will be displayed (key,asset)
                        //
                        this.db.del_key_value(tracking_num) // no buildup of tracking numbers
                        emailer.tracking_num = tracking_num // save for next time (it is stored by this class or parent)
                        this.db.set_key_value(tracking_num, email)  // information that links the user to the reset password
                        //
                    }
                    return true    
                } catch(e) {
                    console.log(e)
                }
                return false
            }
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
            There was an error while attempting to reset your password. Have you already registerd? <a href='https://${this.conf.domain}'>${this.conf.domain}</a>
        </div>
        `
        let logo_body = this.logo_body
        html = logo_body.replace('$$BODY_INSERT',html)
        return(html)
    }

}

    

module.exports = new CaptchaBusines()
