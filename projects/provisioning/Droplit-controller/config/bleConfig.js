var core = require('./core');
var log = require('./config-debug');

var bleConfig = function () {
    var _this = this;

    _this.enable = function () {
        log("Entering setup mode.");
        core.enable();

    }

    _this.disable = function () {
        log("Exiting set up mode.");
        core.disable();
    }

    return _this;
}

module.exports = bleConfig();
