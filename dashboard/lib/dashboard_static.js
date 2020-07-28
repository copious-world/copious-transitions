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
          let static_dash = 'dashboard+' + user
          let dashboard_characteristics = {
            'owner' : user,
            'date'  : ('' + Date.now()),
            'panel_key' : generate_password(),
            'which_dashboard' : 'test dashboard'
          }
          this.db.put_static_store(static_dash,JSON.stringify(dashboard_characteristics),"application/json")
        })
      }
      
    
}


module.exports = new DashboardStatic()
