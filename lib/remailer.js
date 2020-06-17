
// //
// // 

class ReMailer extends EventEmitter {
    
    constructor(mail_transport,props) {
        //
        super()
        //
        this.on('email_this',(email) => {
            this.mailer(email).catch(console.error);
        })

        this.transporter = mail_transport
        this.setMailProps(props)
        //
    }

    //
    setMailProps(props) {
        this.html_template = props.html
        this.text_template = props.text
        this.html = this.html_template
        this.from = this.text_template
        this.subject = props.subject
        this.text = props.text
    }

    //
    async mailer(email) {
        //
        await this.transporter.sendMail({
            from: this.from,          // sender address
            to: email,                // list of receivers
            subject: this.subject,    // Subject line
            text: this.text,          // plain text body
            html: this.html           // html body
        });
        //
        this.html = this.html_template
        this.from = this.text_template
    }

}

module.exports = ReMailer