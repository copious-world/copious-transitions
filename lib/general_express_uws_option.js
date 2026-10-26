import uWS from "uWebSockets.js";




/* ./quiche-client --no-verify https://localhost:9001 */

/* The only difference here is that we use uWS.H3App rather than uWS.App or uWS.SSLApp.
 * And of course, there are no WebSockets in HTTP/3 only WebTransport (coming) */

const app = uWS.App(
// {
//   key_file_name: 'misc/key.pem',
//   cert_file_name: 'misc/cert.pem',
//   passphrase: '1234'
// }
)

const HTTP_CODES =  {
  "100" : "Continue",
  "101" : "Switching Protocols",
  "102" : "Processing",
  "103" : "Early Hints",
  "200" : "OK",
  "201" : "Created",
  "203" : "Non-Authoritative Information",
  "204" : "No Content",
  "205" : "Reset Content",
  "206" : "Partial Content",
  "207" : "Multi-Status",
  "208" : "Already Reported",
  "226" : "IM Used",
  "300" : "Multiple Choices",
  "301" : "Moved Permanently",
  "302" : "Found",
  "303" : "See Other",
  "304" : "Not Modified",
  "305" : "Use Proxy",
  "306" : "Switch Proxy",
  "307" : "Temporary Redirect",
  "308" : "Permanent Redirect",
  "400" : "Bad Request",
  "401" : "Unauthorized",
  "402" : "Payment Required",
  "403" : "Forbidden",
  "404" : "Not Found",
  "405" : "Method Not Allowed",
  "406" : "Not Acceptable",
  "407" : "Proxy Authentication Required",
  "408" : "Request Timeout",
  "409" : "Conflict",
  "410" : "Gone",
  "411" : "Length Required",
  "412" : "Precondition Failed",
  "413" : "Content Too Large",
  "414" : "URI Too Long",
  "415" : "Unsupported Media Type",
  "416" : "Range Not Satisfiable",
  "417" : "Expectation Failed",
  "418" : "I'm a teapot",
  "421" : "Misdirected Request",
  "422" : "Unprocessable Content",
  "423" : "Locked",
  "424" : "Failed Dependency",
  "425" : "Too Early",
  "426" : "Upgrade Required",
  "428" : "Precondition Required",
  "429" : "Too Many Requests",
  "431" : "Request Header Fields Too Large",
  "451" : "Unavailable For Legal Reasons",
  "500" : "Internal Server Error",
  "501" : "Not Implemented",
  "502" : "Bad Gateway",
  "503" : "Service Unavailable",
  "504" : "Gateway Timeout",
  "505" : "HTTP Version Not Supported",
  "506" : "Variant Also Negotiates",
  "507" : "Insufficient Storage",
  "508" : "Loop Detected",
  "510" : "Not Extended",
  "511" : "Network Authentication Required"
}


/**
 * 
 */
class Request {

  constructor(req) {
    this.req = req
    this.url = ""
    this.params = {}
  }

  set_url(url) { this.url = url }

  set_body(body) {
    this.body = body
  }

}


// res.writeStatus('200 OK');

// Write your custom or standard headers
// res.writeHeader('Content-Type', 'application/json');
// res.writeHeader('Access-Control-Allow-Origin', '*');
// res.writeHeader('X-Custom-Header', 'MyValue');

//  this.app.responder(res).status(code).send(data)
/**
 * 
 */
class Response {

  constructor(res) {
    this.res = res
    this.stacked_writes = []
  }

  writeHead(code, header_obj) {
    //
    if ( code !== false ) {
      this.status(code)
    }
    //
    if ( typeof header_obj === 'object' ) {
      for ( let [key,value] of Object.entries() ) {
        this.res.writeHeader(key,value) 
      }
    }
    //
  }

  end(str) {this
    //
    let wres = this
    this.res?.cork(() => {
      while ( wres.stacked_writes.length ) {
        let _str = wres.stacked_writes.shift()
        wres.res.write(_str)
      }
      wres.res.end(str);
    })
    //
  }

  // 
  status(code) {
    if ( code === 200 ) {
      this.res.writeStatus(`${code} OK`);
    } else {
      let follow = HTTP_CODES[code]
      if ( typeof follow === "string" ) {
        this.res.writeStatus(`${code} ${follow}`);
      } else {
        let follow = HTTP_CODES["501"]
        this.res.writeStatus(`501 ${follow}`);
      }
    }
    return this
  }

  // 
  send(str) {
    let header_obj = { "Content-type" : "application/json" }
    this.writeHead(false, header_obj)
    this.end(str)
  }

}



/*
    All the paths from user_service_class.js

    1.  /
    2.  /static/:asset
    3.  /guarded/static/:asset
    4.  /guarded/dynamic/:asset
    5.  /secondary/guarded
    6.  /transition/:transition
    7.  /secondary/transition
    8.  /users/login
    9.  /users/logout
    10. /users/register
    11. /users/forgot
    12. /secondary/users/:action'
    
*/

// In this version, there are so few path possibilities that 
// they can be frozen into one table.

// the values are for the nginx map table

const reduction_table = Object.freeze({
    "/" : "/",
    "/static/:asset" : "/s1",
    "/guarded/static/:asset" : "/g2",
    "/guarded/dynamic/:asset" : "/gd",
    "/secondary/guarded" : "/sg",
    "/transition/:transition" : "/tr",
    "/secondary/transition" : "/st",
    "/users/login" : "/un",
    "/users/logout" : "/ut",
    "/users/register" : "/ur",
    "/users/forgot" : "/uf",
    "/secondary/users/:action" : "/su"
})

/**
 * 
 */
class AppLike {

  constructor(app,conf_obj,exp_db) {
    //
    this._my_copious_conf = conf_obj
    this._extract_conf = () => { return this._my_copious_conf; }
    this._copious_db = exp_db
    //
    this.responder = (res) => { this._res = res; return res; }

    this.paths_to_req_info = {}

    this.app = app
    
  }


  /**
   * 
   * @param {*} err 
   * @param {object} shared_reporter 
   * @param {string} message 
   */
  abort_handler(err,shared_reporter,message) {
    console.log(err,message)
  }


  wrap_req(req,json,req_info) {
    //
    let wreq =  new Request(req)
    //
    wreq.body = json
    let url = req.getUrl();
    wreq.set_url(url)

    let var_names = req_info.var_names

    let i = 0
    for ( let vnm of var_names ) {
        wreq.params[vnm] = req.getParameter(i++)
    }

    return wreq
  }

  wrap_res(res) {
    res = new Response(res)
    return res
  }

  /**
   * 
   * Keep in mind that the structure of the path is settled at the time a new path is entered into the 
   * list of possible method path APIs with their vars. 
   * 
   * By restricting paths to be a small very structued set, a very fast procedure for finding a path can be created.
   * In this case, using the uWebsockets, the path can be hashed into something that the module can scan as fast as possible.
   * The paths are gathered and ultimately dumped to a file for use with nginx (or other).
   * 
   * An nginx map table can be made with the shortened paths for rapid relay of the reverse proxy to the app server backend. 
   * 
   * @param {string} path 
   * @returns {Array} array of strings - the names of vars
   */
  unload_path_vars(path) {
    let path_vars = []
    let path_parts = path.split('/')
    path_parts.shift()
    //
    for ( let part of path_parts ) {
      part = part.trim()
      if ( part[0] === ':' ) {
        path_vars.push(part.substring(1))
      }
    }
    //
    return path_vars
  }


  json_parser(req, res, shared_reporter, async_handler_caller, err_handler_caller) {
    /* collectBody gives the whole body at once, or null if it is bigger than 1 MB */
    res?.res?.collectBody(1024 * 1024, (body) => {
      let json;
      try {
        json = JSON.parse(Buffer.from(body));
        req.set_body(json)
        async_handler_caller(req, res);
      } catch (e) {
        shared_reporter.err = e
        /* Too big, invalid or empty: res.close calls onAborted */
        res.close();
        return;
      }
    });

    /* Register error cb */
    res?.res?.onAborted(err_handler_caller);  // handles abort no data back... while the typical async body will reutunr error reports to the client
  }


  get(path,async_func) {
    // setup -- lasts the run 
    let path_vars = this.unload_path_vars(path)
    //
    let short_path = reduction_table[path]
    // set up for future calls
    this.paths_to_req_info[short_path] = {
      "var_names" : path_vars    // array gives the position of each if it is there (usually just one)
    }
    // the library handler
    this.app.get(short_path,(res, req) => {
      req = this.wrap_req(req,{},this.paths_to_req_info[short_path])
      res = this.wrap_res(res)
      let caller = async (req,res) => {
        await async_func(req,res)
      }
      caller(req,res)
    })
    //
  }

  // /guarded/dynamic/:asset
  post(path,async_func) {
    // setup -- lasts the run 
    let path_names = this.unload_path_vars(path)
    //
    let short_path = reduction_table[path]
    // set up for future calls
    this.paths_to_req_info[short_path] = {
      "var_names" : path_names    // array gives the position of each if it is there (usually just one)
    }
    // the library handler
    this.app.post(short_path,(res, req) => {
      // this is the setup of the uWebsocket to call a typical express style path handler
      let shared_reporter = {}  // state mostly written to by both success and error paths
      req = this.wrap_req(req,{},this.paths_to_req_info[short_path])
      res = this.wrap_res(res)
      let error_handler = (err) => {
        this.abort_handler(err,shared_reporter,path)
      }
      this.json_parser(req,res,shared_reporter,async_func,error_handler,error_handler)
    })

  }

  listen(port) {
    this.app.listen(port, (token) => {
      if (token) {
        console.log('Listening to port ' + port);
      } else {
        console.log('Failed to listen to port ' + port);
      }
    });
  }
}


module.exports.app = app
module.exports.WSClass = AppLike
