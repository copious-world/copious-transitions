# copious-transitions

This is a library that supports building and running web services applications. The library provides generalized classes implementing calling frames for applications to override. The applications may be authorization, uploading media, accessing static pages, accessing dynamic pages requiring state transitions, etc.

From this library, **copious-transition**, the main calling framework provides URL path responses for handling generic transactions. Some transactions may occur in a single call and response. Some may take a few steps and will map the state of the transactions to tokens shared between the servers and the clients. 

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

In each of the applications types, the service components may include a parent class to derive new classes. For example, if an application details the database, it will create a module which imports database classes. For example:

```
const { DBClass, CustomPersistenceDB, CustomStaticDB } = require('copious-transitions')

```

These are classes that are exposed by the top level index.js in the module. They are from more than one file. One of the files is, of course, general\_db.js, which is listed above. There are more classes involved, and these will be explained later. For now, it can be said that the applcation program will override DBClass and export the override from a new module.

When the application starts at its entrypoint, copious-transitions provides a configuration file reader which will look for the file that provides the database override as in the example; it will look for all overrides in the configuration. Then copious-transitions will create instannces of the classes and set up HTML API paths that use the instances when running transactions.

## API Transactions on the High Level




The pathways regulate tokenized access to certain types of media, static, dynamic, and transitional. 

User pathways provide interfaces to login/logout and other possible types of user interactions that a web service might support.
The user pathways may be configured to work with application requirements by allowing for the configuration of modules requirements for modules that 
provide subclassing customizations to generalized classes which carry out commonly occuring backend interfaces. Some of the general modules may interact
with databases, crypto modules, middleware modules, file management modules, etc. Customization may allow for selections of databases, file systems, 
state management processes, etc. 

For example, several types of authorization have been addressed and interfaces to difference repositories have been addressed. Using the copious-transitions
framework, authorization such as logining in, wrapped key with accounts, and derived key with no stored accounts have been developed. There are three
terse application classes for each kind of authorization and each type of authorization descends from the same generalized authorization classes.

Similarly, file uploading has placed files on disks, encrypted or not, and has utiltized IPFS and other storage schemes. Uploading is processed in all
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


### 4. <u>captcha</u>


### 5. <u>captcha-ipfs</u>


### 6. <u>defaults</u>


### 7. <u>local</u>




## Setting up a web service



