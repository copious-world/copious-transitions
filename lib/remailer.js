const EventEmitter = require('events')
// //
// // 

class ReMailer extends EventEmitter {
    
    constructor(mail_transport,props) {
        //
        super()
        //
        this.on('email_this',(email,mail_props) => {
            this.mailer(email,mail_props).catch(console.error);
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
    async mailer(email,mail_props) {
        //
        let text = this.text
        let html = this.html
        if ( mail_props ) {
            text = mail_props.text ? mail_props.text : text
            html = mail_props.html ? mail_props.html : html
        }
        console.log(html)
        //
        await this.transporter.sendMail({
            'from': this.from,          // sender address
            'to': email,                // list of receivers
            'subject': this.subject,    // Subject line
            'text': text,          // plain text body
            'html': html           // html body
        });
        //
        this.html = this.html_template
        this.from = this.text_template
    }

}

module.exports = ReMailer