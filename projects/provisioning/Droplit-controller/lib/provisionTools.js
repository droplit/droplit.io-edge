var mac = require('getmac');

var registerFunc = null;

var controllerId;

var provisionTools = {

    getControllerId : function (callback) {
        if (controllerId) {
            callback(controllerId);
        } else {
            mac.getMac(function(err,macAddress){
                if (err) throw err;
                controllerId = macAddress;
                callback(controllerId);
            });
        }
    },

    setRegisterCall : function(func) {
        registerFunc = func;
    },

    registerUser : function (userToken, callback) {
        registerFunc({ "userToken": userToken }, callback);
    },
    
    registerEmail : function (email, callback) {
        registerFunc({ "email": email }, callback);
    }

};

module.exports = provisionTools;