const TaggedTransition = require.main.require("./lib/tagged_transitions")

/*
// Defaults
class Defaults extends TaggedTransition {
    constructor(descendant) {
        if ( descendant ) {
            super(descendant)
        } else {
            super("default")
        }
    }
}
*/

class DashboardCustomTransitions {
    constructor() {
    }

    initialize() {
    }
}

module.exports = new DashboardCustomTransitions()
