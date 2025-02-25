module.exports = {
    "config" : {
        "db_messenger" : {
            "module" : "message-relay-services",
            "peers" : [],
            "balance_strategy" : "random",
            "communication_class" : "MultiRelayClient",

            "files_only" : false,
            "output_dir" : "fail_over_persistence",
            "output_file" : "/user_data.json",
            "max_pending_messages" : false,
            "file_shunting" : false,
            "max_reconnect" : 24,
            "reconnect_wait" : 5,
            "attempt_reconnect" : true    
        }
    },
    "persistence" : {
        "password" : "admin",
        "module_path" : "captcha-ipfs",
        "cache" : {
            "master_of_ceremonies" : "/Users/richardalbertleddy/Documents/GitHub/copious-transitions/captcha-ipfs",
            "seed" : 9849381,
            "record_size" : 384,
            "el_count" : 20000,
            "proc_names" : [ "captcha-ipfs", "dashboard", "profiles", "song-search", "media-up" ],
        }
    },
    "message_relays" : {
        "port" : 5112,
        "address" : "localhost",
        "files_only" : false,
        "output_dir" : "fail_over_persistence",
        "output_file" : "/user_data.json",
        "max_pending_messages" : false,
        "file_shunting" : false,
        "max_reconnect" : 24,
        "reconnect_wait" : 5,
        "attempt_reconnect" : true
    },
    "ipfs": {
        "repo_location" : "/Users/richardalbertleddy/Documents/GitHub/copious-transitions/local/repos",
        "dir" : "contact-ipfs-repo",
        "swarm_tcp" : 4022,
        "swarm_ws" : 4023,
        "api_port" : 5022,
        "tcp_gateway" : 9797
    },
    "session" : {
        "password" : "admin",
        "module_path" : "captcha-ipfs",
        "cache" : {
            "master_of_ceremonies" : "/Users/richardalbertleddy/Documents/GitHub/copious-transitions/captcha-ipfs/lib",
            "seed" : 9849381,
            "record_size" : 8,
            "el_count" : 20000,
            "proc_names" : [ "captcha-ipfs", "dashboard", "profiles"],    
        }
    }
}
