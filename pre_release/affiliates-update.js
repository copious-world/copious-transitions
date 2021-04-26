let aff_info = {
    'vultr' : `
    <a href="https://www.vultr.com/?ref=8315818" target="_blank">
    <img src="https://www.vultr.com/media/banners/banner_300x250.png" width="300" height="250">
    </a>
    `
}




const fs = require("fs")
const { encode } = require("punycode")

let aff_path = "../sites/copious/static/affiliates.json" 
let aff_data = fs.readFileSync(aff_path).toString()
aff_data = JSON.parse(aff_data)

aff_data.forEach(datum => {
    let ky = datum.name
    if ( aff_info[ky] !== undefined ) {
        //
        let aff_string = aff_info[ky]
        datum.link =  encodeURIComponent(aff_string) 
        //
    }
})


let output = JSON.stringify(aff_data)
fs.writeFileSync(aff_path,output)