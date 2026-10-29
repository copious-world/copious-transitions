// //
//const express = require('express')
//

/**
 * @namespace base
 */


var g_startup_admin_token = global_appwide_token()
console.log(g_startup_admin_token)

var g_app = false

// send(res,200,{ "status" : "OK" })

function _set_conf_and_return(conf_obj,exp_db) {
    if ( conf_obj.uws_option ) {
      const {app, WSApp} = require("./general_express_uws_option")
      g_app =  new WSApp(app,conf_obj,exp_db)
    } else {
      const polka = require('polka');
      const send = require('@polka/send-type');
      //
      //
      g_app = polka()
      g_app._my_copious_conf = conf_obj
      g_app._extract_conf = () => { return g_app._my_copious_conf; }
      g_app._copious_db = exp_db
      //
      g_app.responder = (res) => { g_app._res = res; return g_app; }
      g_app.status = (num) => { g_app._code = num; return g_app; }
      g_app.send = (obj) => {
        send(g_app._res,g_app._code,obj)
      }
    }



    // ----
    g_app.get('/admin_op/token/:token', (req, res) => {
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
      

    return(g_app)
}




module.exports = _set_conf_and_return
