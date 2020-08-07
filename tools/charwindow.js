const fs = require('fs')

//
let file = process.argv[2]
console.log(file)

let char_offset = parseInt(process.argv[3])
console.log(char_offset)

let text = fs.readFileSync(file,'ascii').toString()

let default_wsize = 40
let window = text.substr(char_offset - default_wsize/2, default_wsize)

console.log("-------------------------------------------------------------------")
console.log(window)
console.log("-------------------------------------------------------------------")
