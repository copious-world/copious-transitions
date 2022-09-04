// //
//const express = require('express')
//
const polka = require('polka');
const send = require('@polka/send-type');
const uuid = require('./uuid')
//
var g_app = polka()

var g_startup_admin_token = uuid()
console.log(g_startup_admin_token)



// send(res,200,{ "status" : "OK" })

function _set_conf_and_return(conf_obj,exp_db) {
    g_app._my_copious_conf = conf_obj
    g_app._extract_conf = () => { return g_app._my_copious_conf; }
    g_app._copious_db = exp_db
    //
    g_app.responder = (res) => { g_app._res = res; return g_app; }
    g_app.status = (num) => { g_app._code = num; return g_app; }
    g_app.send = (obj) => {
      send(g_app._res,g_app._code,obj)
    }
    return(g_app)
}



// ----
g_app.get('/admin_op/token/:token', function (req, res) {
    //console.log(req.params)
    if ( req.params ) {
      if ( req.params.token ) {
        if ( req.params.token === g_startup_admin_token ) {
          console.log("shutting down")
          g_app._copious_db.drop()
          process.exit(0)
        }
      }
      res.status(200).send(JSON.stringify( {'type' : 'contact', 'OK' : 'false', 'reason' : 'no session' } ));
    }
  });
  //
  


module.exports = _set_conf_and_return
