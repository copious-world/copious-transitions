const KV_DB = require('../custom_storage/key_value_db')


async function main() {

    let kv_db = new KV_DB();

    await kv_db.initialize({
        "file_cache" : {
            "sync_delta" : 120000
        },
        "disk_storage" : "./data",
        "release_size" : 100,
        "max_in_mem" : 1000,
        "check_mem_interval" : 1000,
        "removal_interval" : 10000
    })


    let tst_key = "general-junk"
    let its_so = await kv_db.exists(tst_key)
    console.log(`key ${tst_key} exists ${its_so ? "true" : "false"}`)

    await kv_db.set(tst_key,{ "test" : "this is a test 1" })

    tst_key = "private-flunk"
    kv_db.set(tst_key,{ "test" : "this is a test 2" })

    let data = await kv_db.get("general-junk")
    console.dir(data)
    let data2 = await kv_db.get("private-flunk")
    console.dir(data2)

    tst_key = "constable-hunk"
    kv_db.set(tst_key,{ "test" : "this is a test 3" })
    let data3 = await kv_db.get("constable-hunk")
    console.dir(data3)

    await kv_db.delete("private-flunk")

    let its_there = await kv_db.exists("private-flunk")
    console.log(`private-flunk is stored in the table ${its_there}`)


    await kv_db.shutdown()

}



main()