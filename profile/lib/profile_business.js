const GeneralBusiness = require.main.require('./lib/general_business')
//const apiKeys = require.main.require('./local/api_keys')
//const myStorageClass = null



class ProfileBusiness extends GeneralBusiness {
    //
    constructor() {
        super()
        this.db = null
        this.rules = null
    }


    //
    process(use_case,post_body) {
        switch ( use_case ) {
            default: {
                return true
            }
        }
   }

    cleanup(transition,pkey,post_body) {
    }

}

    

module.exports = new ProfileBusiness()
