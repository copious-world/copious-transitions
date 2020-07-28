const fs = require('fs')
const path = require('path');
const Handlebars = require('handlebars')


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

function  extension_from_path(src) {
    let srcext = path.extname(src)
    if ( srcext.length === 0 ) {
        srcext = 'text'
    }
    srcext = srcext.replace('.','')
    return srcext
}


function reset_svg_height_width(svg_txt, output_width, output_height) {
    let svg_tag_start = svg_txt.indexOf("<svg")
    let svg_tag_end = svg_txt.indexOf(">",svg_tag_start)
    let tag_text = svg_txt.substr(svg_tag_start,(svg_tag_end - svg_tag_start + 1))
    //
    if ( output_width ) {
        tag_text = tag_text.replace(/width=".*"/,`width="${output_width}"`)
    }
    if ( output_height ) {
        tag_text = tag_text.replace(/height=".*"/,`height="${output_height}"`)
    }
    svg_txt = svg_txt.substring(0, svg_tag_start) + tag_text + svg_txt.substring(svg_tag_end + 1);
    //
    return(svg_txt)
}



function is_file_source(descr) {
    return ((typeof descr === 'object') && ( descr.file || ( descr.content && descr.content.file ) || ( descr.button && descr.button.file ) ))
}



var g_compiler_schedule = []

function  process_sub_content(datObj,descr) {
    let src_file = descr.file ? descr.file : ( descr.content ? descr.content.file : descr.button.file );
    try {
        if ( src_file[0] === '.' ) {
            src_file = datObj.srcPath + src_file.substr(1)
        }
        let src = fs.readFileSync(src_file,'utf8').toString()
        //
        let operator = { 'data' : datObj, 'source' : src, 'target' : descr }
        //
        if ( descr.button && descr.button.file ) {
            operator.target = descr.button
        }
        let ext = extension_from_path(src_file)
        descr.ext = ext
        if ( ext === "svg" ) {
            if ( descr.output_height || descr.output_width ) {
                operator.alteration = (content) => {
                    return(reset_svg_height_width(content, descr.output_width, descr.output_height))  
                }
            }
        }
        g_compiler_schedule.unshift(operator)
    } catch (e) {
        g_forgotten_files.push(src_file)
        console.log(e.message)
    }
}


var g_forgotten_files = []
function load_source_data(datObj,src) {
    g_compiler_schedule.unshift({ 'data' : datObj, 'source' : src })
    for ( let field in datObj ) {
        let descr = datObj[field]
        if ( (typeof descr === 'object') && descr.length ) {
            descr.forEach(element => {
                if ( is_file_source(element) ) {
                    process_sub_content(datObj,element)
                }
            })
        } else if ( is_file_source(descr) ) {
            process_sub_content(datObj,descr)
        }
    }
}



// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
var data_file = process.argv[2]
var source_file = process.argv[3]
var output = process.argv[4]
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


console.log("SOURCE FILE: " + source_file)

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
var data = fs.readFileSync(data_file,'ascii').toString()
var confObj = JSON.parse(data)
//
confObj.srcPath = path.dirname(data_file)
var source = fs.readFileSync(source_file,'utf8').toString()
load_source_data(confObj,source)

//console.dir(confObj)
//

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
var result = "nothing"
g_compiler_schedule.forEach(operator => {
    //let operator = { 'data' : datObj, 'source' : src, 'target' : descr }
    let source = operator.source
    let template = Handlebars.compile(source);
    let confObj = operator.data
    //console.dir(confObj)
    let content = template(confObj);
    if ( operator.alteration ) {
        content = operator.alteration(content)
    }
    if ( operator.target ) {
        operator.target.content = content
    }
    result = content
})


console.log("OUTPUT FILE: " + output)
fs.writeFileSync(output,result)

if ( g_forgotten_files.length ) {
    console.log("echo > " + g_forgotten_files.join('\necho > '))
}
