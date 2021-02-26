const fsPromises = require('fs/promises')
const fs = require('fs')
const path = require('path')


// this static template compiler
// for now
const Handlebars = require('handlebars')

const g_output_dir = "test_output"
const g_template_dir = './user_templates'

// 
async function load_template_package(dirpath,noisy,cb) {
    try {
        let files = await fsPromises.readdir(dirpath)
        let p_list = files.map(async file => { 
            let ext = path.extname(file)
            if ( ext == ".html" ) {
                if ( noisy ) {
                    console.log(file)
                }
                //
                let fpath = dirpath + '/' + file
                try {
                    let html_tmplt = await fsPromises.readFile(fpath)
                    html_tmplt = html_tmplt.toString()
                    let file_key = file.replace(ext,'')
                    await cb(html_tmplt,file_key)
                    return(true)
                } catch (e) {
                    console.error(e)
                }
                //
            }
            return(false)
        })
        let results = await Promise.all(p_list)
        return results
    } catch (e) {
    }
}



// ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ----



// to be spawned --- do not want to keep this in process... 


async function generate_user_custom_file(path,template_src,user_obj) {
    try {
        let template = Handlebars.compile(template_src);
        let content = template(user_obj);
        fs.writeFile(path,content,(err) => {})    
    } catch (e) {
        console.error(e)
    }
}




async function run_all(input_dir,user_dir,user_obj) {
    //
    await load_template_package(input_dir,true, async (html_template,ky_path) => {
        let out_path = `${user_dir}/${ky_path}.html`
        if ( user_obj.dir_paths ) {
            user_obj.dir_paths[`${ky_path}`] = out_path.substr(1)
        }
        generate_user_custom_file(out_path,html_template,user_obj)
    })
    //
}

/*
let user_obj = {
    "text" : "this is some text",
    "user_name" : "witty smitty",
    "date" : (new Date()).toUTCString(),
    "file" : uuid()
}

run_all(g_template_dir,g_output_dir,user_obj)
*/

module.exports.asset_generator = run_all