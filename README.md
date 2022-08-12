# copious-transitions

This is a library that supports building and running web services applications. The library provides generalized classes implementing calling frames for applications to override. The applications may handle authorization, uploading media, accessing static pages, accessing dynamic processes that require state transition management, etc.

The applications may be separate processes, each with their own TCP port. They will share information with each other via shared memory for such requirements as access control. Some of the applications may run on different nodes in a cluster. Information sharing will be controlled by the use of certain libraries providing shared memory management and pub/sub processes.

How big or small the footprint of the service will be will depend mostly on configuration. Each application will read in a configuration file and marshal parts of it to subprocesses and library class instances. Some aspects of configuration will direct the subprocesses to connect on pub/sub pathways on predetermined addresses and ports. Some application will want to automate high level configuration of nodes in their own way. This module provides configuration mostly at the process level, but provides pathways to open up configuration at a higher level.

## Installation

```
npm install copious-transitions --save
```


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

### Main Process Script

In all, the manner in which files are brought into the processes makes the main program very simple. The following is an example of a complete main application script:

```
const CopiousTransitions = require('copious-transitions')

let [config,debug] = [false,false]

config = "./user-service-igid.conf"
if ( process.argv[2] !== undefined ) {
    config = process.argv[2];
}

if (  process.argv[3] !== undefined ) {
    if ( process.argv[3] === 'debug' ) {
        g_debug = true
    }
}

let transition_app = new CopiousTransitions(config,debug)


transition_app.on('ready',() => {
    transition_app.run()
})
```

When the application starts at its entrypoint, **copious-transitions** provides a configuration file reader. The configuration reader will look for the file that provides the database override as in the example; it will look for all overrides in the configuration. Then **copious-transitions** will create instances of the classes and set up HTML API paths that use the instances when running transactions.


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
* **/secondary/guarded :: POST ::** a transition keyed on a token from guarded paths
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


### 2. <u>contractual</u>


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

### 6. <u>local</u>



## Setting up a web service



