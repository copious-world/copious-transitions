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


function subcompile(src,datObj) {
    var template = Handlebars.compile(src);
    src = template(confObj);
    return(src)
}

var g_forgotten_files = []
function load_source_data(datObj) {
    for ( let field in datObj ) {
        let descr = datObj[field]
        if ( (typeof descr === 'object') && ( descr.file || ( descr.content && descr.content.file ) || ( descr.button && descr.button.file ) ) ) {
            let src_file = descr.file ? descr.file : ( descr.content ? descr.content.file : descr.button.file );
            try {
                if ( src_file[0] === '.' ) {
                    src_file = datObj.srcPath + src_file.substr(1)
                }
                let src = fs.readFileSync(src_file,'utf8').toString()
                //
                src = subcompile(src,datObj)
                //
                let ext = extension_from_path(src_file)
                if ( descr.file ) {
                    descr.content = src
                } else if ( descr.content && descr.content.file ) {
                    descr.content = src
                } else if ( descr.button && descr.button.file ) {
                    descr.button.content = src
                }
                descr.ext = ext
                if ( ext === "svg" ) {
                    if ( descr.output_height || descr.output_width ) {
                        //
                        if ( descr.content ) {
                            descr.content = reset_svg_height_width(descr.content, descr.output_width, descr.output_height)
                        }
                        //
                    }
                }
            } catch (e) {
                g_forgotten_files.push(src_file)
                console.log(e.message)
            }
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
load_source_data(confObj)

//console.dir(confObj)
//

var source = fs.readFileSync(source_file,'utf8').toString()
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
var template = Handlebars.compile(source);
var result = template(confObj);

console.log("OUTPUT FILE: " + output)

fs.writeFileSync(output,result)

if ( g_forgotten_files.length ) {
    console.log("echo > " + g_forgotten_files.join('\necho > '))
}
