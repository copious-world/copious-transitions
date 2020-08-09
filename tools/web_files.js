const fs = require('fs')
const minify = require('html-minifier').minify;
const tar = require('tar')
const {exec} = require('child_process')
const path_util = require('path')
const util = require('util');
const asyc_exec = util.promisify(exec);

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
var g_html_web_directories = []
var g_releaseObject = {}


const g_src_dir =  '../release' // 'release'  // 
var g_config_file = '../release/release.json' //  'release.json'  // 
try {
    var releaseObj_str = fs.readFileSync(g_config_file,'ascii').toString()
    try {
        g_releaseObject = JSON.parse(releaseObj_str)
    } catch (e) {
        console.error(`failed to parse the file '${g_config_file}'`)
        console.error(e)
        process.exit(0) 
    }
} catch (e) {
    console.error(`failed to find the file '${g_config_file}'`)
    process.exit(0)
}

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----



// ensureExists
// does what it says.
function ensureExists(path, mask) {
    if (typeof mask == 'undefined') { // allow the `mask` parameter to be optional
        cb = mask;
        mask = 0777;
    }
    var p = new Promise((resolve,reject) => {
        fs.mkdir(path, mask, function(err) {
            if (err) {
                if (err.code == 'EEXIST') resolve(null); // ignore the error if the folder already exists
                else reject(err); // something else went wrong
            } else resolve(null); // successfully created folder
        });

    })
    return p
}

function ensurePathExists(path,mask) {
    let where_all = path.split('/')
    where_all.shift()
    where = ''
    where_all.forEach(async level => {
        where += '/' + level
        try {
            await ensureExists(where,mask)
        } catch (e) {
            if (e.code != 'EEXIST') {
                console.log(e)
            }
        }
    })
    return(where)
}


function get_directory_from_list(dir_list,base_dname) {
    let dir = dir_list.find(adir => {
        console.log(adir,base_dname)
        return(adir.indexOf(base_dname) >= 0 )
    })
    return(dir)
}

async function locate_html_directory(conf) {

    let nginx_loc = conf.conf_location
    let cmd = `grep -rE 'root\\s+/' ${nginx_loc}/*.conf`
    console.log(cmd)
    try {
        const { stdout, stderr } = await asyc_exec(cmd)

        let lines = stdout.split('\n')
        let good_line = lines.filter(line => {
            if ( line.length == 0 ) return(false)
            if ( line.indexOf(':') >= 0 ) {
                line = line.split(':')[1]
            }
            let l = line.trim()
            return(l[0] !== '#')
        })

        g_html_web_directories = good_line.map(line => {
            if ( line.indexOf(':') >= 0 ) {
                line = line.split(':')[1]
            }
            line = line.replace('root','')
            line = line.trim()
            line = line.replace(';','')
            return(line)
        })
    } catch (e) {

    }

    console.log(g_html_web_directories)

    // /etc/nginx/sites-enabled/default:	root /var/www/html;
    // /etc/nginx/sites-enabled/popsongnow.conf:	root /var/www/html/popsongnow;

}


function move_html(doms) {
    for ( let dom in doms ) {
        //
        let dom_dots = dom.split('.')
        let base_dname = dom_dots[1]
        //console.log(base_dname, g_html_web_directories)
        let dir = get_directory_from_list(g_html_web_directories,base_dname)
        //console.log(dir)
        if ( dir !== undefined ) {
            //
            ensurePathExists(dir)
            //
            let domObj = doms[dom]
            let files = domObj.html.files
            files.forEach(file => {
                let fpath = `${g_src_dir}/${dom}/${file}.html`
                let target = `${dir}/${file}.html`
                fs.copyFileSync(fpath,target) 
            })
            //
        }
    }
}

async function process_web_files() {
    //g_html_web_directories = [ '/usr/local/var/www/html/popsongnow', '/usr/local/var/www/html/copious' ]  // /var/www/html/popsongnow
    await locate_html_directory(g_releaseObject.nginx)
    move_html(g_releaseObject.domains)
}

process_web_files()