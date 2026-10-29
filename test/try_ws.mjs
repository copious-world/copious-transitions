

import WebSocketManager from "../lib/websocket.js"
import uWS from "uWebSockets.js";


let wsM = new WebSocketManager()


const app = uWS.App(
// {
//   key_file_name: 'misc/key.pem',
//   cert_file_name: 'misc/cert.pem',
//   passphrase: '1234'
// }
)

let conf = {
    "web_sockets" : {
        "web_socket_server_class" : "test",
        "http_module" : false,
        "ports" : {
            "port_names" : [ "transitional", "auth" ],
            "defs" : {
                "transitional" : 20,
                "auth" : 30
            }
        },
        "http_module"  : "uct_http_module"
    }
}


console.dir(wsM)


wsM.initialize(conf,app)




/*


import { SymbolType, FunctionType, loadLibrary } from 'node:ffi'; // Node 26+ built-in FFI
import { fileURLToPath } from 'node:url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Resolve platform-specific library name and path
const platform = process.platform; 
const arch = process.arch;        
let libName = '';

if (platform === 'win32') {
  libName = 'my_lib.dll';
} else if (platform === 'darwin') {
  libName = 'libmy_lib.dylib';
} else {
  libName = 'libmy_lib.so'; // Linux and others
}

const libPath = path.resolve(__dirname, `../bin/${platform}-${arch}/${libName}`);

// 2. Open the dynamic library using the modern node:ffi API
const myLib = loadLibrary(libPath);

// 3. Define and export symbols
export const add = myLib.getFunction({
  name: 'add',
  references: [],
  implementation: FunctionType.create({
    result: SymbolType.get('i32'),
    parameters: [SymbolType.get('i32'), SymbolType.get('i32')]
  })
});




{
  "name": "my-ffi-package",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.js",
  "files": [
    "src",
    "bin"
  ],
  "engines": {
    "node": ">=26.9.0" 
  }
}


.npmignore
# Exclude raw source code and native build artifacts
native_src/
target/
*.target.mk
build/
.git


*/