const fs = require('fs')
const builtinModules = require('builtin-modules');

let builtInSet = {}
builtinModules.forEach(mod => {
    builtInSet[mod] = 1
})


let text = fs.readFileSync('reqfile.txt','ascii').toString()
let text_lines = text.split('\n')

let trimmed_lines = text_lines.map(line => { return(line.trim())})

let filtered_lines = trimmed_lines.filter(line => {
    if ( line.substr(0,2) === '//' ) return(false)
    if ( line.indexOf('"require') >= 0 ) return(false)
    if ( line.indexOf('require.main.require') >= 0 ) return(false)
    if ( (line.indexOf("require('.") >= 0) || line.indexOf('require(".') >= 0 ) return(false) 
    if ( line.indexOf('lib/') >= 0 ) return(false)
    if ( line.indexOf('/package.json') >= 0 ) return(false)
    if ( line.indexOf(".js')") >= 0 ) return(false)
    return((line.indexOf('require("') >= 0) || (line.indexOf("require('") >= 0))
})

//console.log(filtered_lines.join('\n'))

let extracted_lines = filtered_lines.map(line => {
    let b = line.split('require(')
    let rest = b[1]
    rest = rest.substr(0,rest.indexOf(')'))
    return(rest)
})

//console.log(extracted_lines.join('\n'))

let mod_set = {}

extracted_lines.forEach(line => {
    line = line.replace("'","").replace("'","").trim()
    line = line.replace('"',"").replace('"',"").trim()
    mod_set[line] = 1
})


for ( let mod in builtInSet ) {
    delete mod_set[mod]
}


let mod_list = Object.keys(mod_set)
mod_list.sort()

let npm_commands = mod_list.map(mod => {
    let cmd = `npm install ${mod} --save`
    return(cmd)
})


console.log(npm_commands.join('\n'))
