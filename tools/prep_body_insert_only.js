const fs = require('fs')

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

//$$BODY_INSERT 
// fauth_logged_in_closer.html
// fauth_fail_closer.html
// fauth_success_closer.html

// node prep_body_insert_only.js ../${dir}/static/template/${body_source}  ../${dir}/static/${source}  ../${dir}/static/tmp_output.html


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
var template_file = process.argv[2]
var source_file = process.argv[3]
var output = process.argv[4]
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


console.log("SOURCE FILE: " + source_file)

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
var template = fs.readFileSync(template_file,'ascii').toString()
var source = fs.readFileSync(source_file,'utf8').toString()
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

let result = template.replace('$$BODY_INSERT',source)
fs.writeFileSync(output,result)
