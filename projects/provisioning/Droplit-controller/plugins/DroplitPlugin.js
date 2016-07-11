/**
 * Created by Bryan on 6/17/2014.
 */

var constants = require('./DroplitConstants');

var eventEmitter = require('events').EventEmitter,
    util = require('util');

var droplitPlugin = function() {
    var _this = this;

    /**
     * device information structure - used to standardize the layout of device information
     * @typedef {Object} DeviceInfo
     * @param {string} identifier - device unique identifier (within this device class)
     * @param {object} address - device address on this network
     * @param {string} productName - manufacturer assigned name
     * @param {string} productType - generic product description
     * @param {string} manufacturer
     * @param {string} name - user assigned friendly name
     * @param {string} location - user assigned location
     * @param {string[]} services - list of services supported on this device
     * @param {Object} promotedMembers - list of properties and methods that are promoted formatted as 'serviceName.memberName[:alias]'
     */

    /**
     * the doneCallback notifies the caller when the method has completed
     * @callback requestCallback
     * @param {number} responseCode
     * @param {string} responseMessage
     */

    /**
     * Attempts to connect to the gateway or device physical interface. Sometimes causes a device discovery
     * @param {Object} connectInfo - device type specific connection/initialization information
     * @param {requestCallback} callback - callback upon completion. responseCode will be of type ConnectResult
     */
    _this.connect = function(connectInfo) {

    };

    /**
     * This method will be called before the system shuts down.
     */
    _this.disconnect = function() {

    };

    /**
     * Discovers all devices of the provider's device type
     */
    _this.discover = function() {

    };

    _this.callServiceMethod = function(identifier, address, serviceName, methodName, params) {
        if (!params) params = [];
        params.unshift(identifier, address);
        _this.log('calling %s.%s on ident %s add %s with %s', serviceName, methodName, identifier, address, JSON.stringify(params));
        var method = getServiceMember(serviceName, methodName);
        if (method) {
            var isSupported = method.apply(_this, params);
            return getMethodStatus(isSupported);
        } else {
            // method not implemented
            return constants.MethodStatus.NOT_IMPLEMENTED;
        }
    };

    _this.getServiceProperty = function(identifier, address, serviceName, propertyName, callback) {
        _this.log('get property %s %s %s %s', identifier, address, serviceName, propertyName);
        var getMethod = getServiceMember(serviceName, 'get_' + propertyName);
        if (getMethod) {
            //_this.log('invoking property getter');
            var isSupported = getMethod(identifier, address, function(value) {
                //_this.log('returning from getter. got ' + value);
                callback({"result": constants.MethodStatus.OK, "value": value});
            });
            //if (!isSupported) callback({"result": constants.MethodStatus.NOT_IMPLEMENTED});;
            return getMethodStatus(isSupported);
        } else {
            callback({"result": constants.MethodStatus.NOT_IMPLEMENTED});
            return constants.MethodStatus.NOT_IMPLEMENTED;
        }
    };


    _this.setServiceProperty = function(identifier, address, serviceName, propertyName, value) {
        _this.log('set property %s %s %s %s %s', identifier, address, serviceName, propertyName, value);
        var setMethod = getServiceMember(serviceName, 'set_' + propertyName);
        if (setMethod) {
            try {
                var isSupported = setMethod(identifier, address, value);
                return getMethodStatus(isSupported);
            } catch (err) {
                _this.logError('Error setting property ', err.stack);
            }
        } else {
            return constants.MethodStatus.NOT_IMPLEMENTED;
        }
    };

    // expects { identifier, address, serviceName, propertyName, value }
    _this.setServiceProperties = function(properties) {
        _this.log('set properties', properties);
        properties.forEach(function(property) {
            var setMethod = getServiceMember(property.serviceName, 'set_' + property.propertyName);
            if (setMethod) {
                try {
                    setMethod(property.identifier, property.address, property.value);
                } catch (err) {
                    _this.logError('Error setting property ', err.stack);
                }
            }
        });
    };
    
     /**
     * NOtifies plugin that a device was deleted by user
     */
    _this.deleteDevice = function(identifier, address) {

    };

    _this.command = function(message) {
        // do nothing unless implemented in child class
    };

    // events

    /**
     * Call this method once the connection is established
     * @param {number} responseCode
     * @param {string} responseMessage
     */
    _this.connected = function(responseCode, responseMessage) {
        _this.emit('connected', responseCode, responseMessage);
    };

    /**
     * Causes the deviceDiscovered event to be raised
     * @param {DeviceInfo} deviceInfo
     * @param {Object} deviceMetaData
     */
    _this.deviceDiscovered = function(deviceInfo, deviceMetaData) {
        _this.emit('device discovered', deviceInfo, deviceMetaData);
    };

    _this.deviceChanged = function(deviceInfo, deviceMetaData) {
        _this.emit('device changed', deviceInfo, deviceMetaData);
    };

    _this.discoveryComplete = function() {
        _this.emit('discovery complete');
    };

    _this.servicePropertyChanged = function(identifier, serviceName, propertyName, value) {
        _this.emit('service property', identifier, serviceName, propertyName, value);
    };

    _this.serviceEvent = function(identifier, serviceName, eventName, param) {
        _this.emit('service event', identifier, serviceName, eventName, param);
    };

    _this.log = function () {
        _this.emit('log info', arguments);
    };

    _this.logInfo = function () {
        _this.emit('log info', arguments);
    };

    _this.logError = function () {
        _this.emit('log error', arguments);
    };

    function getServiceMember(serviceName, memberName) {
        try {
            var serviceClass = _this.services[serviceName];
            if (serviceClass) {
                var getMethod = serviceClass[memberName];
                if (getMethod) {
                    return getMethod;
                } else {
                    // get not implemented
                    _this.logError('property not implemented', serviceName, propertyName)
                    return;
                }
            } else {
                // service not implemented
                _this.logError('service not implemented', serviceName)
                return;
            }
        } catch (err) {
            _this.logError('Error locating service member', err.stack);
            return;
        }
    }

    function getMethodStatus(isSupported) {
        if (isSupported == null || isSupported == undefined) {
            return constants.MethodStatus.OK;
        } else {
            return (isSupported == true ? constants.MethodStatus.OK : constants.MethodStatus.NOT_SUPPORTED);
        }
    }

};

util.inherits(droplitPlugin, eventEmitter);
module.exports = droplitPlugin;
