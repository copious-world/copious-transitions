// //
var express = require('express')
//
var g_app = express()

function _set_conf_and_return(conf_obj) {
    g_app._my_copious_conf = conf_obj
    g_app._extract_conf = () => { return g_app._my_copious_conf; }
    return(g_app)
}

module.exports = _set_conf_and_return
