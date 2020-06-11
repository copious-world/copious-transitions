const fs = require('fs')


function load_parameters() {
    let config = "./user-service.conf"
    if ( process.argv[2] !== undefined ) {
        config = process.argv[2];
    }
    try {
        let confJSON = JSON.parse(fs.readFileSync(config,'ascii').toString())
        return(confJSON)
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}



var g_all_config = load_parameters()

console.dir(g_all_config)

var g_known_module_list = [ "db", "middleware", "authorizer", "validator",  "static_assets" ]
//
function output_initial_module_code() {
    let path = g_all_config.module_path
    fs.mkdirSync(__dirname + '/' + path,{ 'recursive' : true, "mode" : 0o777 })
    g_known_module_list.forEach(m_name => {
        let module_text = "require('whatever')"
        fs.writeFileSync(`${path}/${g_all_config.modules[m_name]}.js`,module_text,{ 'mode' : 0o666, 'encoding' : 'ascii'})
    })
}

output_initial_module_code()