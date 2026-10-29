# The Fields Used in Configuration Files



  

* `domain` -  the website domain name (DNS) e.g. "copious.world",

* `module_path` - a dirctory offset from the working dir to custom modules

* `port` - the HTTP port number,

* `ws_port` - WebSocket Port for a server,

* `ws_client_port` - If this server instance will connect as a client to a websocket, the server port.

* `user_cookie` - "copiousToken" or one for your concern,

* `forgetfulness_tag` - some tag identifying a user post request for those who forget passwords,

* `login_app` - [ "/users/login", "/users/logout", "/users/register", "/users/forgot" ],

* `html_wrapper_with_logo` - "personals-templates/header-empty.html" or other app wrapper HTML page,

* `login_amelioration` - "join_process()",

* `second_login_amelioration` - "already_logged_in()",

* `failed_password_amelioration` - "login_retry_password()",

* `failed_registration_duplicate` - "already_registered()",

* **`modules`** - a map of standard module identifiers to application modules found in `module_path`

> * `custom_transitions` - "captcha_transitions",

> * `db` - "captcha_db",

> * `middleware` - "captcha_mware",

> * `authorizer` - "captcha_auth",

> * `validator` - "captcha_validator",

> * `static_assets` - "captcha_static",

> * `dynamic_assets` - "captcha_dynamic",

> * `expression` - "captcha_express",

> * `business` - "captcha_business"

* `static_db`- static DB configuration
* `persistence_db` - persistence DB configuration
* `middleware` - for express apps, etc.  Loaded from configuration when not called out in the module `<app>_express` 
* `use_secure_transfer` - setup HTTPS

* `static_files` - where to locate static files
* `field_set` - part of validation
* `forgot` -  what to do with forgotten passwords
* `forhash` - fields used in generating hash based keys
* 
