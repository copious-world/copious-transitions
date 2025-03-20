# copious-transitions

**Purpose:** The main purpose of this module is to provide a framework for handling state transition requests, where requests are messages from UI clients and/or backend services. 

Some requests may be delivered as HTTP requests. Other requests may be delivered as backend JSON messages. The message handlers may be thought of as API handlers that are aware of authorized sessions and their states.


**Transition tokens:** Sessions own transition tokens that key data being used in a state transition. The tokens, ***transition tokens***, are made by services implemented with respect to this framework. They are made in response to initial requests and are tracked by secondary requests. Tokens go back to requesters, clients. If the requester makes more requests with regard to a single requested transtion, the requesters must send the the transition's token back to the services in order to recognize secondary actions that drive a state transition towards completion.

**Development:** This library supports building and running web services applications by providing several types of HTTP API endpoints. The API (URI) forms specify general classes of activity and may be parameterized by the names of transitions or actions. Then, most POST requests will contain JSON objects that describe a transition or a media request or a user action.

This library provides application developers classes implementing general behavior for dealing with requests. These generalized classes provide method for use within calling frames. And, these methods are for applications to override. Depending on how a method overrides the methods, the applications may handle authorization, uploading media, accessing static pages, accessing dynamic processes requiring state transition management, etc. by customizing extensions of these classes. In turn, the generalized classes provide execution pathways which may be used without alteration.

**Processes and distribution:** The extending applications may be separate processes, each with their own TCP port. ***They will share information with each other via shared memory for such requirements as access control.*** Some of the applications may run on different nodes in a cluster. Information sharing will be controlled by the use of certain libraries providing shared memory management and pub/sub processes.

**the main:** How big or small the footprint of the service will be will depend mostly on configuration. Each application will create an instance of the same main class, **CopiousTransitions**. This application instance will read the configuration file to look for the application's extension classes which the **CopiousTransitions** instance knows how to use.


## Main Process Script

Each application mentions its extension classes in a configuration file. While these classes will get most of their functionality from their general base classes, their specific implementations will drive their operation through processing decisions and customization of resource usage such as database connections.

In some applications, the configuration will direct the subprocesses to connect on pub/sub pathways on predetermined addresses and ports. Some applications will want to automate high level configuration of nodes in their own way.

In all, the manner in which files are brought into the processes makes the main program very simple. The following is an example of a complete main application script:

```
const CopiousTransitions = require('copious-transitions')

let [config,debug] = [false,false]

// the application definition is here.
config = "./user-service-myapp.conf"

if ( process.argv[2] !== undefined ) { // conf file on command line
    config = process.argv[2];
}

if (  process.argv[3] !== undefined ) { // maybe debug
    if ( process.argv[3] === 'debug' ) {
        g_debug = true
    }
}

// the following line can be the same line for all applications

let transition_app = new CopiousTransitions(config,debug)


transition_app.on('ready',() => {
    transition_app.run()
})
```

When the application starts at its entrypoint, **copious-transitions** provides a configuration file reader. The configuration reader will look for the file that provides the database override as in the example; it will look for all overrides in the configuration. Then **copious-transitions** will create instances of the classes and set up HTML API paths that use the instances when running transactions.



## Installation

```
npm install copious-transitions --save
```


## Configuration

The configuration is required. 

For an application to be useful, it must provide overrides of the general classes provided by the module. How these classes are addressed is determined by the so called `contractual` modules. Application classes must be useable by the contractual modules. (Also, they use and expose methods to the classes they are extending and each other. Hence, there is API documentation.)

The application classes are specified in the configuration file along with other applications parameters, such as ports and addresses and security configuration parameters. Applications may extend the basic configuration to set up their downstream connections, database connections, special directories, etc. But, the basic configuration will be present in all derived applications. 

Here is an example of a basic configuration:

```


{
  "domain": "copious.world",
  "module_path": "captcha/lib",
  "port": "2006",
  "ws_port": "2007",
  "ws_client_port" : false,
  "foreign_auth_port" : "2009",
  "user_cookie": "copiousToken",
  "forgetfulness_tag": "DOY",
  "login_app": [ "/users/login", "/users/logout", "/users/register", "/users/forgot" ],
  "html_wrapper_with_logo": "personals-templates/header-empty.html",
  "foreign_authorizer_api_enpoint": "https://www.copious.world/fauth",
  "login_amelioration": "join_process()",
  "second_login_amelioration": "already_logged_in()",
  "failed_password_amelioration": "login_retry_password()",
  "failed_registration_duplicate": "already_registered()",
  "modules": {
    "custom_transitions": "captcha_transitions",
    "db": "captcha_db",
    "middleware": "captcha_mware",
    "authorizer": "captcha_auth",
    "validator": "captcha_validator",
    "static_assets": "captcha_static",
    "dynamic_assets": "captcha_dynamic",
    "expression": "captcha_express",
    "business": "captcha_business"
  },
  "static_db" : {
    "blob_dir" : "local/static_db",
    "freeloading_timeout" : 7200000,
    "max_data_RAM" : 25000000,
    "max_forwarded_storage" : 256,
    "knowledge_domains" : {},
    "db_file" : "local/static_db/userdata.db"
  },
  "persistence_db" : {
    "knowledge_domains" : {},
    "db_file" : "local/userdata.db"
  },
  "middleware": {
    "session": [],
    "transforms": []
  },
  "use_secure_transfer" : false,
  "sessions": {
    "secret": "this is secret no doubt"
  },
  "static_files": {
    "reason": "files listed here will override the directory entries",
    "files": [],
    "directory": "statics",
    "app_spec": "captcha/static"
  },
  "field_set": {
    "reason": "some fields may be specified in conf, others in the application module",
    "login": {
      "email": {
        "field_type": "email"
      },
      "password": {
        "field_type": "password"
      },
      "strategy": {
        "field_type": "foreign_auth"
      }
    },
    "register": {
      "email": {
        "field_type": "email"
      },
      "name": {
        "field_type": "lengthy-alpha",
        "length": {
          "min": 2,
          "max": 32
        }
      },
      "password": {
        "field_type": "password",
        "length": {
          "min": 8,
          "max": 24
        },
        "code": "A2C2N2S2"
      },
      "verify_password": {
        "field_type": "password-verify"
      }
    },
    "forgot": {
      "email": {
        "field_type": "email"
      },
      "password": {
        "field_type": "password",
        "length": {
          "min": 8,
          "max": 24
        },
        "code": "A2C2N2S2"
      },
      "verify_password": {
        "field_type": "password-verify"
      }
    },
    "password-reset": {
      "password": {
        "field_type": "password",
        "length": {
          "min": 8,
          "max": 24
        },
        "code": "A2C2N2S2"
      }
    }
  },
  "forhash": {
    "field1": "email",
    "field2": "password"
  },
  "foreign_auth": {
    "allowed" : true,
    "api_enpoint": "https://www.copious.world/fauth",
  }
}

```

This configuration is used by the included example implementation `captcha`. This is an old, but still working implentation. Newer ones rely less on the validation and may be using distributed identies, etc. The newer implementations may be published as their own module.

Notice the field **modules**. This is a map from application independent module names to the application files which export class instances to the main. The main CopiousTransitions class instance will look for the modules to load in the diretory `module_path`, which is another field on the configuration object. Here the directory is "captcha/lib". In the configuration the exention of the files is not mentioned, but the file names are being passed to node.js **require**. 

(Note: an extension of this module might load modules in other ways. For instance, if a Bun version is created, Typescript could be used.)

Other fields in the configuration are supported by basic general classes, including `field_set` and `middleware`. But, some of the other are specific to the application. The configuration object is passed to the basic classes when the main calls `initialize` for their object instances.

More on configuration can be found here: [link to configuration doc]()


## Contractual Modules

Some modules have been set aside and have been dubbed `contractual` to indicate that they provide a promised flow logic for handling requests with respect to sessions and tokens. The term `contractual` as used here should not be confused with blockchain contracts, although such a functional module might be added in the future.

The `contractual` modules process transactions based on a few web API paths. Most of these respond to POST methods that expect JSON objects carrying session identifiers, state machine tokens, and relevant data. The `contractual` path handlers pass off *safe* objects to the methods implemented (overrides) by the application classes.

The `contractual` modules may be foun in the directory `contractual`. The files included are the following:

* mime_processing.js - handle static and dynamic content requests
* user_processing.js - handles user session management
* transition_processing.js - handles transitions, requests for action

The class implementations in these files call out to the authorization module for access and permissions. The job of producing transaction tokens is given to the authorization module. The contractual module will stash tokens and make appropriate calls to the authorization module in order to gain access to the transition engine. If data is requested via mime processing, the mime methods will call out to static or dynamic handlers after getting permission from the authorization module.

The transition processing methods will call on the authorization modules to invoke transition processing. The authorization module makes the transition object and determines the number of times it will be used across primary and seconday requests. Transition processing calls on the authorization module to finalize state transition which results in a change to the session state. In the case of user processing, finalization comes in the flavor of *starting* a user session. But, a state transition is finalized in the authorization module as well. Often state finalization requires a call out to the DB or to the transition engine, neither of which are accessible from the `contractual` modules. But, state finalization may also involve encryption and decryption which is accessible via authorization.



## Transactions and Classes

The name, **copious-transition**, is meant to evoke the idea of state transitions. The main idea is that clients will synchronize their awareness of the state of a process by keeping track of a transition token. The kinds of state transitions might be characterized by ATM or Petri Net transions. (*Some of the meat of this will come later as this repository grows. At the moment there are very basic transitions needed that can be hardwired in for common website operations. More on that later.*)

From this library, **copious-transition**, the main calling framework provides URL path responses, a.k.a. web APIs, for handling generic transactions. Some transactions may occur in a single call and response. Some may take a few steps and will map the state of the transactions to tokens shared between the servers and the clients.

Classes are provided for performing parts of common web transactions. These classes have such roles as authorization, database interaction, processes management, etc. Here is a list of some of the generic classes provided by this library:

* general\_auth.js
* general\_db.js
* general\_lifecyle.js		
* general\_transition\_engine.js
* general\_auth\_session\_lite.js	
* general\_dynamic.js		
* general\_mware.js	
* general\_validator.js
* general\_business.js
* general\_express.js
* general\_static.js

These files include classes that are exposed by the top level index.js in the module directory. They classes in index.js are from more than one file.

In each of the applications types, the service components may include a parent class to derive new classes. For example, if an application details the database, it will create a module which imports database classes. For example:

```
const { DBClass, CustomPersistenceDB, CustomStaticDB } = require('copious-transitions')

```

In the example, one class is taken from general\_db.js, which is listed above. There are more classes involved -- these will be explained later. For now, it can be said that the application program will override DBClass and export the override from a new module. And, the calling program will pick up the new class from the configuration.

## API Transactions on the High Level

Keeping the main program simple means that some web API paths, as in parts of URLs, will be determined by the **copious-transions** code. Some clients may want more flexibility in stating their paths. And, they can have that by creating proxies closer to the clients using node.js or nginx or other generic web servers. Or, they can write separate services from the ones made available here, where the ones provided by **copious-transions** provide authorization and token tracking. 

> The API pathways provided by **copious-transions** regulate tokenized access to certain types of media, static assets, dynamically generated assets, and transitional processes.

The API paths are written with variable expressions in a manner defined by **express.js**, **fastly.js**, or **polka.js**.

Here is a list of common pathways that are defined in the **CopiousTransitions** class definition found in the file **user\_services\_class.js**:

* *path :: HTTP METHOD :: description*
* **/ :: GET ::** returns a local index.js for default behavior
* **/static/:asset :: GET ::** returns an asset keyed in a static db 
* **/guarded/static/:asset :: POST ::** returns an asset after authorization checks
* **/guarded/dynamic/:asset :: POST ::** authorized and optionally confirmed asset generation
* **/secondary/guarded :: POST ::** a request keyed on a token from guarded paths
* **/transition/:transition :: POST ::** start of a process and guarded
* **/secondary/transition :: POST ::** continuation of a process and guarded
* **/user/:operation :: POST ::** configurable list of paths offering the following:

> * login
> * logout
> * registration

* Additional paths for setting up web sockets, and other types of generic paths.

> The path list categorizes a types of transactions. Furthermore, there is a basic logical format for dealing with transactions and transitions. 



User pathways provide interfaces to login/logout and other possible types of user interactions that a web service might support.
The user pathways may be configured to work with application requirements by allowing for the configuration of modules requirements for modules that 
provide subclassing customizations to generalized classes which carry out commonly occuring backend interfaces. Some of the general modules may interact
with databases, crypto modules, middleware modules, file management modules, etc. Customization may allow for selections of databases, file systems, 
state management processes, etc. 

For example, several types of authorization have been addressed and interfaces to difference repositories have been addressed. Using the copious-transitions
framework, authorization such as logining in, wrapped key with accounts, and derived key with no stored accounts have been developed. There are three
terse application classes for each kind of authorization and each type of authorization descends from the same generalized authorization classes.

Similarly, file uploading has placed files on disks, encrypted or not, and alternatively has utiltized IPFS and other storage schemes. Uploading is processed in all
cases by the same transtional pathways which check session and captcha prior to allowing data transfer. And, terse customized subclasses of transition 
engines have provided choices for the type of medium onto which the uploaders place files. In each case, some custom code is required for utilizing 
types of storage and this custom code is required beyond the normalization done by file systems.

Copious-transitions applications are servers. A single web service will have a number of servers handling similar paths but different logic.
The copious-transitions package makes it easy to decide that one server may handle sessions lifecylces and that other servers will obtain shared 
session inforamtion within a local cluster. A process can be configured to include or omit user management API pathways. While all servers will include token
authorized media pathways. 


## What's in Certain Directories


### 1. <u>lib</u>

All the files mentioned in the previous section are to be found in the *lib* directory. There are a few more files beyond what was discussed.

### 2. <u>contractual</u>

The contractual modules were discussed in the previous section **Transactions and Classes**.


### 3. <u>custom storage</u>

The **custom\_storage** directory contains some default key-value store operations for static (local) assets and for persistent data, which may be stored both locally and remotely.

This section refers to persistent and static storage. The terms are common among storage schemes. For example, the copious-world repositories (to be found on github) includes global-persitence and copious-endpoints, which has a persistence endpoint. The terms related to this particular directory refer more to an interface to persistent storage services with some local buffering and aging requirements.

* **static storage**

> The one requirement static storage is supposed to fulfill is that particular files (data) will be gauranteed to be quickly accessible. If the files are being used regularly, they will be maintained in processes memory. If they age out of storage, then static storage will have a local file reference to the local data. If requested file is not on local drives, then static storage may refer to persistent storage to obtain a copy from remote caches. Static storage fails to deliver only if the file cannot be found in any storage the configured instance of a copious-transisions implementation ever knows about.

* **persistent storage**

> Data and files are considered to be persistent if there is some representation of the data somewhere in repositories that the copious-transisions implementation knows about and if the data can be retrieved. Persistent storage may store some data in memory (in the LRU sense) for a short period of time. It may be assumed that data will age out faster than static data. Persistent storage is not required to always keep a copy of data locally if it can be guaranteed to obtain it from some cache. 
> 
> Persistent storage may take in new data from the client facing processes and store it locally and in remote repositories. When a copious-transisions implementation takes in new data it can use persistent storage key-value APIs to proxy sending data to endpoints that curate the data and make it available to other services such as link services and counting services.

A copious-transisions implementation accesses the static and persistent storage code via the **generalized\_db** class and its descendant implementations.

Persistent storage acts as a proxy to upstream repositories only as a user of communication class instances, those most likely provided by the **message-relay-services** module. The persistent storage class provided by **custom\_storage** does not create the connection to endpoint services, but will be constructed with an instance of the communication class which must have been created by the **generalized\_db** class descendant. (Note: **generalized\_db** does not create default class instances and just provides a calling framework.)

> Persistent storage in  **custom\_storage** communicates with data repositories providing some business transactions only because its communication class instance is configured to talk to those services. Persistent storage has no concept of what upstream services do. It just manages the lifecycle of data on the local machine and sends messages.

*Refer to descendants of* **generalized\_db** *in order to determine the business logic of the database interface instance*.

### 4. <u>captcha</u>

This is an example web application that provides common web page login with an SVG captcha. 

### 5. <u>defaults</u>

These are default instance classes each of which descends from a generalized class from the **lib** directory. If a configuration fails to introduce a class for a particular role, a default class will be used instead. The default classes do next to nothing but they are not necessarily noops.




