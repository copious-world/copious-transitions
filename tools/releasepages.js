const fs = require('fs')
const minify = require('html-minifier').minify;
const tar = require('tar')
const {exec} = require('child_process')
const path_util = require('path')
 
const scp = require('node-scp')

var g_ssh_pass = process.argv[2]
console.log(g_ssh_pass)
if ( g_ssh_pass === undefined ) {
    console.error('No ssh password provided')
    process.exit(1)
}

var g_releaseObject = null
try {
    var releaseObj_str = fs.readFileSync('release.json','ascii').toString()
    try {
        g_releaseObject = JSON.parse(releaseObj_str)
    } catch (e) {
        console.error("failed to parse the file 'release.json'")
        console.error(e)
        process.exit(0) 
    }
} catch (e) {
    console.error("failed to find the file 'release.json'")
    process.exit(0)
}

console.dir(g_releaseObject)


// // // // // // // // // // 


function extract_vars(rm_ctl_tmpl) {
    let varset = []
    let parts = rm_ctl_tmpl.split('${')
    if ( parts.length ) {
        for ( let i = 1; i < parts.length; i++ ) {
            let var_head = parts[i]
            var_head = var_head.substr(0,var_head.indexOf('}'))
            varset.push(var_head)
        }
    }
    return varset
}


function subst_vars(tmplt,srcObj) {
    let var_list = extract_vars(tmplt)
    let result = [tmplt]
    if ( var_list.length ) {
        var_list.forEach(aVar => {
            let value = srcObj
            let vaccess = aVar.split('.')
            while ( vaccess.length ) {
                let key = vaccess.shift()
                if ( ( key === '$keys()' ) && ( typeof value === 'object' ) ) {
                    if ( value.length ) {
                        let vstore = []
                        value.forEach(val => {
                            for ( let k in val ) {
                                vstore.push(val[k])
                            }
                        })
                        value = vstore
                    } else {
                        let vstore = []
                        for ( let k in value ) {
                            vstore.push(value[k])
                        }
                        value = vstore    
                    }
                } else {
                    if ( ( typeof value === 'object' ) && value.length ) {
                        let nvalue = value.map(vobj => {
                            return(vobj[key] !== undefined ? vobj[key] : '' )
                        })
                        value = nvalue
                    } else {
                        value = value[key]
                    }
                }
            }
            if ( typeof value === 'string' ) {
                let finalResult = result.map( rtmplt => rtmplt.replace('${' + aVar + '}',value) )
                result = finalResult
            } else if ( ( typeof value === 'object' ) && value.length ) {
                let nresult = []
                value.forEach(val => {
                    let finalResult = result.map( rtmplt => rtmplt.replace('${' + aVar + '}',val) )
                    nresult = nresult.concat(finalResult)       
                })
                result = nresult
            }
        })
    }
    return(result)
}

function extracToVar(replVar,head_region,tail_region,fileString) {
    let results = ['','']
    //   
    let [header,rest] = fileString.split(head_region,2)
    let end_parts = rest.split(tail_region)
    //
    console.log(end_parts.length)
    let salvaged = end_parts.shift()
    let backend = end_parts.join(tail_region)
    //
    results[0] = header + replVar + backend
    results[1] = salvaged
    //
    return(results)
}


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


function instantiate_top_level(obj,directives) {
    for ( let ky in obj ) {
        let val = obj[ky]
        if ( typeof val === 'string' ) {
            if ( (val[0] === '@') &&  (val[0] !== '/') ) {
                val = val.replace(val,directives[val])
            }
        }
        obj[ky] = val
    }
}

function subst_var(templt,substs) {
    let output = templt
    for ( let subst in substs ) {
        let val = substs[subst]
        let the_var = "${" + subst + "}"
        let update = output.replace(the_var,val)
        while ( update !== output ) {
            output = update
            update = output.replace(the_var,val)
        }
    }
    return(output)
}


function calc_var(singlevar_calc,val) {
    try {
        let parts = singlevar_calc.split(':')
        let the_var = parts[0]
        let the_form = parts[1]
        the_form = the_form.replace(the_var,val)
        let vv = ''
        the_form = 'vv = ' + the_form
        eval(the_form)
        return(vv)
    } catch (e) {
        console.log(e)
    }
    return('')
}

function drop_s(str) {
    let c = str[str.length-1]
    if ( c === 's' ) {
        str = str.substr(0,str.length-1)
    }
    return(str)
}

// ---------- ---------- ---------- ---------- ---------- ---------- ---------- ---------- ---------- ---------- ----------

function output_nginx_dom_conf(dom_config,output) {
    let where = dom_config.conf + ".conf"
    fs.writeFileSync(where,output)
}

function nginx_releaser(config) {
    if ( config === undefined ) {
        console.warn("nginx cannot be configured")
        return;
    }
    let conf_file_template_name = config.templates.top.src
    let location_tmplt_name = config.templates.location.src
    config.templates.top.text = fs.readFileSync(conf_file_template_name,'ascii').toString()
    config.templates.location.text = fs.readFileSync(location_tmplt_name,'ascii').toString()
    config.templates.ws_path = config.templates.top // @top to be calculated at some later date
    //
    for ( let tmpl in config.templates ) {
        let template = config.templates[tmpl]
        template.vars = extract_vars(template.text)
    }
    //
    let map_calc = config.calc_maps
    let plurals = map_calc.plurals
    //
    // not catching this exception
    let doms = config.domains
    for ( let dom in doms ) {
        let domdef = doms[dom]
        instantiate_top_level(domdef,{ "@key" : dom })
    }
    //
    let conf_file_vars = config.templates.top.vars
    //
    for ( let dom in doms ) {
        for ( let ky in config.templates ) {
            let tmplt = config.templates[ky]
            tmplt.output = tmplt.text
        }
        let domdef = doms[dom]
        plurals.forEach(items => {
            if ( conf_file_vars.indexOf(items) >= 0  ) {
                if ( domdef[items] !== undefined ) {
                    let def_list =  domdef[items]
                    let singlevar_calc = map_calc.single
                    let defKeys = Object.keys(def_list)
                    let item_var = calc_var(singlevar_calc,items)
                    let val_var = map_calc.single_var
                    let templt = config.templates[item_var].output
                    let vars = config.templates[item_var].vars
                    let expanded = defKeys.map(item => {
                        let val = def_list[item]
                        let substs = {}
                        substs[item_var] = item
                        substs[val_var] = val
                        let output = subst_var(templt,substs)
                        return(output)
                    })
                    let text = config.templates.top.output
                    let substs = {}
                    substs[items] = expanded.join('\n')
                    text = subst_var(text,substs)
                    config.templates.top.output = text
                }
             } else {
                let def_list =  domdef[items]
                let singlevar_calc = map_calc.single
                let defKeys = Object.keys(def_list)
                let one_key = defKeys[0]
                let item_var = calc_var(singlevar_calc,items)
                if ( conf_file_vars.indexOf(item_var) >= 0  ) {
                    let templt = config.templates[item_var].output
                    let val = def_list[one_key]
                    let val_var = map_calc.single_var
                    let substs = {}
                    substs[item_var] = one_key
                    substs[val_var] = val
                    let output = subst_var(templt,substs)
                    config.templates[item_var].output = output
                    //
                }
            }
        })
        //
        // done with plurals
        for ( let defky in domdef ) {
            if ( plurals.indexOf(defky) < 0 ) {
                let val = domdef[defky]
                let text = config.templates.top.output
                substs = {}
                substs[defky] = val
                text = subst_var(text,substs)
                config.templates.top.output = text
            }
        }

        output_nginx_dom_conf(config.domains[dom],config.templates.top.output)

    } // end of a dom
}


function compress_html_file(compressable) {
    let result = minify(compressable, {
        removeAttributeQuotes: false,
        caseSensitive : true,
        collapseWhitespace : true,
        conservativeCollapse : true,
        html5 : true,
        keepClosingSlash : true,
        minifyCSS : true,
        minifyJS : true,
        sortClassName : true
      });
    return result
}

// var g_siteURL = "localhost";
function prepareHtmlFile(filePath,dmn) {
    //
    let url = dmn
    /// 
    let fileString = fs.readFileSync(filePath,'utf8').toString()
    fileString = fileString.replace('var g_siteURL = "localhost";',`var g_siteURL = "${url}";`)
    fileString = fileString.replace('var g_siteURL = "localhost";',`var g_siteURL = "${url}";`)

    // loop this
    fileString = fileString.replace('localhost:',`${url}:`)
    fileString = fileString.replace('localhost:',`${url}:`)
    fileString = fileString.replace('localhost:',`${url}:`)
    fileString = fileString.replace('localhost:',`${url}:`)
    fileString = fileString.replace('localhost:',`${url}:`)
    fileString = fileString.replace('localhost:',`${url}:`)

    //
    let pure_region_spec = g_releaseObject.dont_compress
    let replVar = pure_region_spec.replace_var
    let head_region = pure_region_spec.match_head
    let tail_region = pure_region_spec.match_tail

    let [compressable,salvaged] = extracToVar(replVar,head_region,tail_region,fileString)
    //
    salvaged = head_region + salvaged + tail_region
    //
    fileString = compress_html_file(compressable)
    fileString = fileString.replace(replVar,salvaged)
    //
    fs.writeFileSync(filePath,fileString)
}

function process_remote_control() {
    return(subst_vars(g_releaseObject.remote_control,g_releaseObject)[0])
}

/*
// testing for future ref... ignore
function process_remote_locations() {
    return(subst_vars(g_releaseObject.remote_html,g_releaseObject))
}
function process_micro_servs_locations() {
    return(subst_vars(g_releaseObject.remote_micros,g_releaseObject))
}
// // // // // // // // // // // // // // // //
var rm_command = process_remote_control()
console.log(rm_command)

var rm_locations = process_remote_locations()
console.log(rm_locations)

var micros_locations = process_micro_servs_locations()
console.log(micros_locations)
*/




async function stage_html() {
    let releaseDir = g_releaseObject.staging.folder
    try {
        await ensureExists('./' +  releaseDir)
        Object.keys(g_releaseObject.domains).forEach (async dmn => {
            try {
                await ensureExists('./' +  releaseDir + '/' + dmn)
                let directive = g_releaseObject.domains[dmn]
                let srcpath = directive.html.from
                let filename = directive.html.file + ".html"
                fs.copyFileSync(srcpath + '/' + filename,'./' +  releaseDir + '/' + dmn + '/' + filename)
                try {
                    prepareHtmlFile('./' +  releaseDir + '/' + dmn + '/' + filename,dmn)
                } catch (e) {
                    console.error(e)
                }
            } catch (e) {
                console.error(e)
            }
        })
    } catch(e) {
        console.error(e)
    }
}


async function stage_micros() {
    //
    let releaseDir = g_releaseObject.staging.folder
    try {
        await ensureExists('./' +  releaseDir)
        Object.keys(g_releaseObject.domains).forEach (async dmn => {
            try {
                await ensureExists('./' +  releaseDir + '/' + dmn)
                await ensureExists('./' +  releaseDir + '/' + dmn  + '/home')
                let dest = './' +  releaseDir + '/' + dmn  + '/home'
                //
                let directive = g_releaseObject.domains[dmn]
                let srcpath = directive.micros.from
                let file_map = directive.micros.files
                let file_list = Object.keys(file_map)
                //
                file_list.forEach(async filename => {
                    if ( file_map[filename] ) {
                        let path = srcpath + '/' + filename
                        fs.copyFileSync(path,dest + '/' + filename)
                    }
                })
                //
                let node_modules_src = srcpath + '/node_modules'
                let module_dest = dest + '/node_modules'
                await ensureExists(module_dest)
                //
                let special_node_modules = g_releaseObject.staging.special_node_modules
                special_node_modules.forEach(async mod => {
                    await ensureExists(module_dest + `/${mod}`)
                    let mod_dest_file = `/${mod}/index.js`
                    fs.copyFileSync(node_modules_src + mod_dest_file,module_dest + mod_dest_file)
                })
                //
                let spec_content_list =  g_releaseObject.staging.special_content
                spec_content_list.forEach(spc_content => {
                    let file = spc_content.file
                    let content_txt = spc_content.text
                    fs.writeFileSync(dest + `/${file}`,content_txt)
                })
                //                
            } catch (e) {
                console.error(e)
            }
        })
    } catch(e) {
        console.error(e)
    }
}


async function zip_release() {
    let releaseDir = g_releaseObject.staging.folder
    await tar.c(
        {
          gzip: true,
          file: releaseDir + '.tgz'
        },
        [releaseDir]
      )
}

async function upload_release() {
    let releaseFile = g_releaseObject.staging.folder + '.tgz'
    //let bashline = `scp ${releaseFile} ${dest_machine}:/home`
    //await run_bash(bashline)

    const c = await scp({
        host: g_releaseObject.target.host,
        port: 22,
        username: g_releaseObject.target.user,
        password: `${g_ssh_pass}`,
    })
    await c.uploadFile(releaseFile, '/home/release.tgz')
    c.close() // remember to close connection after you finish    
}


async function gen_bash_script() {
    //
    let script = ["pushd /home"]
    let releaseDir = g_releaseObject.staging.folder
    //
    script.push(`tar xf ${releaseDir}.tgz`)
    script.push(`rm ${releaseDir}.tgz`)
    Object.keys(g_releaseObject.domains).forEach (dmn => {
        let dw_d = dmn.replace('www.','')
        script.push(`cp  ${releaseDir}/${dmn}/home/*.js ${dw_d}/`)
        script.push(`cp  ${releaseDir}/${dmn}/home/*.html ${dw_d}/`)
        //
        let directive = g_releaseObject.domains[dmn]

        let html_path = g_releaseObject.remote_html

        script.push(`cp  ${releaseDir}/${dmn}/${directive.html.file}.html ${html_path}/${directive.html.subdir}`)
        //
        let src = `${releaseDir}/${dmn}/home/node_modules/`
        let dest = `${dw_d}/node_modules/`
        script.push(`cp -R --no-dereference --preserve=all --force --one-file-system --no-target-directory "${src}" "${dest}"`)
    });
    //
    script.push(`cp  ${releaseDir}/ecosystem.config.js ./`)
    script.push('pm2 start ecosystem.config.js')
    script.push('popd')
    //
    let out_script = script.join('\n')
    try {
        await ensureExists('./' +  releaseDir)
        fs.writeFileSync('./releaser.sh',out_script)
    } catch(e) {
        console.error(e)
    }
    //
}


async function output_ecosystem() {
    // first generate ecosystem
    let releaseDir = g_releaseObject.staging.folder
    let ecosystem = ''
    let allapps = []
    try {
        await ensureExists('./' +  releaseDir)
        Object.keys(g_releaseObject.domains).forEach (async dmn => {
            try {
                //
                let directive = g_releaseObject.domains[dmn]
                let file_map = directive.micros.files
                let file_list = Object.keys(file_map)

                let homedir = directive.micros.subdir
                //
                let appsmap = file_list.map(filename => {
                    let appOb = null
                    let ext = path_util.extname(filename)
                    if ( file_map[filename] && (ext !== '.html') ) {
                        let basename = filename.replace(ext,'')
                        appOb = {
                            "name"        : basename,
                            "script"      : `/home/${homedir}/${filename}`,
                            "watch"       : true,
                            "env": {
                                "NODE_ENV": "development",
                            },
                            "env_production" : {
                                "NODE_ENV": "production"
                            }
                        }
                    }
                    return(appOb)
                })
                appsmap = appsmap.filter((obj) => { return(obj != null ) })
                allapps = allapps.concat(appsmap)

               

            } catch(e) {
                console.error(e)
            }
        })
        //
        allapps = JSON.stringify(allapps,null,2)
        ecosystem = `module.exports = {  apps : ${allapps} }`
        //
        fs.writeFileSync(`./${releaseDir}/ecosystem.config.js`,ecosystem)
        //
    } catch(e) {
        console.error(e)
    }

}

function run_releaser() {
    let rm_ctl_command = process_remote_control()
    console.log(rm_ctl_command)
    exec(rm_ctl_command,(err,stdout,stderr) => {
        if ( err ) {
            console.error(stderr)
            console.error(err)
        } else {
            console.log(stdout)
        }
    })
}

// 
nginx_releaser(g_releaseObject.nginx)
/*
stage_html()
stage_micros()
output_ecosystem()
gen_bash_script()
zip_release()
upload_release()
run_releaser()
*/
///
/*


npm install mime


pm2 ls
pm2 stop 0
pm2 start express-captcha.js
pm2 start express-signup.js.js
pm2 restart 0

# Start all applications
pm2 start ecosystem.config.js

# Start only the app named worker-app
pm2 start ecosystem.config.js --only worker-app

# Stop all
pm2 stop ecosystem.config.js

# Restart all
pm2 start   ecosystem.config.js
## Or
pm2 restart ecosystem.config.js

# Reload all
pm2 reload ecosystem.config.js

# Delete all
pm2 delete ecosystem.config.js

*/