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



var g_config_file = '../release/release.json'
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



locate_html_directory(g_releaseObject.nginx)


