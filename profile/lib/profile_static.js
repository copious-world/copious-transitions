const GeneralStatic = require.main.require('./lib/general_static')

const myStorageClass = null

class ProfileStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
    }

    initialize(db_obj,conf) {
        super.initialize(db_obj,conf)
        this.profile_application_initialize()
    }

    // 
    profile_application_initialize() {
      let users = this.db.all_keys('user')
      users.forEach(user => {
        let static_dash = 'profile+' + user
        let profile_characteristics = {
          'owner' : user,
          'date'  : ('' + Date.now()),
          'panel_key' : generate_password(),
          'which_profile' : 'test profile'
        }
        this.db.put_static_store(static_dash,JSON.stringify(profile_characteristics),"application/json")
      })
    }
      
    
}


module.exports = new ProfileStatic()
