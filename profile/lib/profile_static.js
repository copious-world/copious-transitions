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
        let [static_dash,dash_info] = this. _user_static_descriptors(user)
        this.db.put_static_store(static_dash,dash_info,"application/json")
      })
      /*
      this.db.static_synchronizer((user) => {  
        let [static_dash,dash_info] = this. _user_static_descriptors(user)
        //[static_dash,dash_info]
      })
      */
    }

    _user_static_descriptors(user_id) {
      let static_dash = 'profile+' + user_id
      let profile_characteristics = {
        'owner' : user_id,
        'date'  : ('' + Date.now()),
        'panel_key' : generate_password(),
        'which_profile' : 'test profile'
      }
      return [static_dash,JSON.stringify(profile_characteristics)]
    }
    
}


module.exports = new ProfileStatic()
