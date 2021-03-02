const GeneralStatic = require.main.require('./lib/general_static')

const myStorageClass = null

class DashboardStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
    }

    initialize(db_obj,conf) {
        super.initialize(db_obj,conf)
        this.dashboard_application_initialize()
    }

    // 
    dashboard_application_initialize() {
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
      let static_dash = 'dashboard+' + user_id
      let dashboard_characteristics = {
        'owner' : user_id,
        'date'  : ('' + Date.now()),
        'panel_key' : generate_password(),
        'which_dashboard' : 'test dashboard'
      }
      return [static_dash,JSON.stringify(dashboard_characteristics)]
    }
    
}


module.exports = new DashboardStatic()
