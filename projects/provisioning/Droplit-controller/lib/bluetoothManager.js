var debug = require('debug');
var log =  debug('hub:ble');

var serverSocket;

var services = [];

var bluetoothManager = function(socket) {
    serverSocket = socket;

    // setup BLE
    serverSocket.emit('ble start', {}, function(response) {
        response.serviceUuids.forEach(function(serviceUuid) {
            addService(serviceUuid);
        });
        initBLE();
    });

    serverSocket.on('ble service add', function(message) {
        addService(message.serviceUuid);
    });

    serverSocket.on('ble write', function(message, ret) {
        var peripheral = peripherals[message.peripheralUuid];
        if (peripheral) {
            // peripheral exists
            if (devicesConnected[message.peripheralUuid]) {
                // connection open, proceed
                writeCharacteristic(peripheral, message.serviceUuid, message.characteristicUuid, message.value, function(error, success) {
                    ret(success);
                });
            } else {
                // no connection, store the command for when the connection is open
                message.command = 'write';
                queueCommand(message.peripheralUuid, message, 30000);
            }
        } else {
            // never heard of him
            log('ble write: unknown peripheral', message.peripheralUuid);
            ret(false);
        }
    });

    serverSocket.on('ble read', function(message, ret) {

    });

    serverSocket.on('ble notify', function(message) {

    });

    return this;
}

var commandQueue = {};

function queueCommand(peripheralUuid, command, duration) {
    var queue = commandQueue[peripheralUuid];
    if (!queue) {
        commandQueue[peripheralUuid] = queue = [];
    }
    command.expires = new Date();
    command.expires += duration;
    queue.push(command);
}

function addService(serviceUuid) {
    if (services.indexOf(serviceUuid) == -1) {
        services.push(serviceUuid);
    }
}

function foundDevice(device, callback) {
    //serverSocket.emit('ble device discovered', stringifyDevice(device));
    serverSocket.emit('ble discover', device, function(response) {
        callback(response);
    });
    //log('ble device discovered', device);
}

function charNotify(peripheralUuid, serviceUuid, characteristicUuid, state) {
    serverSocket.emit('ble notify', {peripheralUuid: peripheralUuid, serviceUuid:serviceUuid, characteristicUuid: characteristicUuid, state:state});
    log('ble notify', characteristicUuid, state);
}

function deviceConnect(peripheral) {
    serverSocket.emit('ble connect', {peripheralUuid: peripheral.uuid});
}

function deviceDisconnect(peripheral) {
    serverSocket.emit('ble disconnect', {peripheralUuid: peripheral.uuid});
}

function stringifyDevice(device) {
    return JSON.stringify(device, function(key, value) {
        if (key.indexOf('_') == 0) {
            // skip this member
            return undefined;
        } else if(key == 'isConnected') {
            return undefined;
        } else {
            return value;
        }
    });
}

var noble = null;

function initBLE() {
    if (noble) return; // ble already started
    noble = require('noble');
    log('======== ble started');

    noble.on('scanStart', function() {
        log('ble scan started');
    });

    noble.on('scanStop', function() {
        log('ble scan stopped');
    });

    noble.on('stateChange', function(state) {
        log('ble state changed ', state);
        if (state === 'poweredOn') {
            noble.startScanning([], true); // everybody come on
        } else {
            noble.stopScanning();
        }
    });

    noble.on('discover', function(peripheral) {
        deviceSeen(peripheral);
    });
}

var deviceExclusions = ['9003b7e7ac80'];
var devicesSeen = {};
var devicesConnected = {};
var peripherals = {};
var deviceConfiguration = {};

var MAX_CONNECT_INTERVAL = 10000;

function deviceSeen(peripheral) {
    if (deviceExclusions.indexOf(peripheral.uuid) >= 0) return; // ignore this device
    if (devicesSeen[peripheral.uuid]) {
        // update last seen and rssi
        var device = devicesSeen[peripheral.uuid];
        device.lastSeen = new Date();
        device.rssi = peripheral.rssi;
        // TODO: check for outstanding requests

        // connect if watched device
        if (isDeviceWatched(device)) {
            if ((new Date() - device.lastConnect) > MAX_CONNECT_INTERVAL && devicesConnected[peripheral.uuid] == false) {
                device.lastConnect = new Date();
                // setup events
                peripheral.removeListener('connect', disconnectEvent);
                peripheral.removeListener('disconnect', disconnectEvent);
                peripheral.once('connect', connectEvent);
                peripheral.once('disconnect', disconnectEvent);
                peripheral.connect(function(err) {
                    if (err) {
                        log('ble err connecting:', err.stack);
                    } else {
                        //device.isConnected = true;
                        log('device connected successfully:', device.uuid);
                        // leave connection open and do something useful
                        var deviceConfig = deviceConfiguration[device.uuid];
                        discoverCharacteristics(peripheral, deviceConfig, function(error, services, characteristics) {
                            if (error) {
                                log('ble error re-discovering', error);
                            } else {
                                applyDeviceConfig(peripheral, deviceConfig);
                            }
                        });
                    }
                });
            }
        }
    } else {
        // setup events
        peripheral.removeListener('connect', disconnectEvent);
        peripheral.removeListener('disconnect', disconnectEvent);
        peripheral.once('connect', connectEvent);
        peripheral.once('disconnect', disconnectEvent);
        // store device info
        var device = getDeviceInfo(peripheral);
        devicesSeen[peripheral.uuid] = device;
        // init last seen
        device.lastSeen = new Date();
        device.lastConnect = new Date();
        readDeviceNow(peripheral, device, function(isConnected) {
            // disconnect if this device is not needed
            if (isDeviceWatched(device)) {
                // do something with device. The connection is still open.
                log('device is watched:', device.uuid);
            } else {
                // disconnect from device; we don't care about this one right now
                disconnectPeripheral(peripheral, device);
            }
            foundDevice(device, function(deviceConfig) {
                deviceConfiguration[device.uuid] = deviceConfig;
                applyDeviceConfig(peripheral, deviceConfig);
            });
        });
    }
}

function discoverCharacteristics(peripheral, deviceConfig, callback) {
    var serviceUuids = [];
    var characteristicUuids = [];
    for (var serviceUuid in deviceConfig) {
        serviceUuids.push(serviceUuid);
        characteristicUuids.push(deviceConfig[serviceUuid]);
    }
    log('ble discovering', serviceUuids, characteristicUuids);
    peripheral.discoverSomeServicesAndCharacteristics(serviceUuids, characteristicUuids, callback);
}

function applyDeviceConfig(peripheral, deviceConfig) {
    for (var serviceUuid in deviceConfig) {
        var charUuid = deviceConfig[serviceUuid];
        var characteristic = getCharacteristic(peripheral, serviceUuid, charUuid);
        if (characteristic) {
            characteristic.removeAllListeners('read');
            characteristic.on('read', function(state) {
                charNotify(peripheral.uuid, serviceUuid, charUuid, state);
            });
            characteristic.notify(true, function(err) {
                if (err) {
                    log('ble notify setup err', err);
                } else {
                    log('ble notify setup', charUuid);
                }
            });
        }
    }
}

function getCharacteristic(peripheral, serviceUuid, charUuid) {
    var service = null;
    for (var key in peripheral.services) {
        var item = peripheral.services[key];
        if (item.uuid == serviceUuid) {
            service = item;
            break;
        }
    }
    var characteristic = null;
    if (service) {
        for (var key in service.characteristics) {
            var item = service.characteristics[key];
            if (item.uuid == charUuid) {
                characteristic = item;
                break;
            }
        }
    }
    return characteristic;
}

function writeCharacteristic(peripheral, serviceUuid, charUuid, value, callback) {
    var characteristic = getCharacteristic(peripheral, serviceUuid, charUuid);
    if (characteristic) {
        characteristic.write(value, false, function(error) {
            callback(null, error ? false : true);
        });
    } else {
        callback(null, false);
    }
}

function isDeviceWatched(device) {
    var retVal = false;
    services.forEach(function(serviceUuid) {
        if (device.serviceUuids.indexOf(serviceUuid) >= 0) {
            retVal = true;
        } else if (device.services && device.services[serviceUuid]) {
            retVal = true;
        }
    });
    return retVal;
}

function disconnectEvent() {
    var peripheral = this;
    devicesConnected[peripheral.uuid] = false;
    deviceDisconnect(peripheral);
    log('ble device disconnected', peripheral.uuid);
}

function connectEvent() {
    var peripheral = this;
    devicesConnected[peripheral.uuid] = true;
    peripherals[peripheral.uuid] = peripheral;
    deviceConnect(peripheral);
    log('ble device connected', peripheral.uuid);
}

function disconnectPeripheral(peripheral, device) {
    peripheral.disconnect(function (err) {
        //device.isConnected = false;
        if (err) {
            log('ble err disconnecting:', peripheral.uuid, err.stack);
        } else {
            log('ble device disconnected:', peripheral.uuid);
        }
    });
}

function getDeviceInfo(peripheral) {
    return {
        "uuid": peripheral.uuid,
        "name": peripheral.advertisement.localName,
        "serviceUuids": peripheral.advertisement.serviceUuids,
        "rssi": peripheral.rssi
    }
}

function readDeviceNow(peripheral, device, callback) {
    peripheral.connect(function(err) {
        if (err) {
            log('ble err connecting:', err.stack);
            if (callback) {
                callback(false);
            }
        } else {
            log('ble device discovering', peripheral.uuid);
            //device.isConnected = true;
            // find out everything the device can do
            peripheral.discoverAllServicesAndCharacteristics(function(err, services, characteristics) {
                log('ble discover callback', peripheral.uuid);
                // keep the properties we're interested in
                if (err) {
                    log('ble err reading:', err.stack);
                } else {
                    device.services = {};
                    services.forEach(function(service) {
                        var serviceInfo = {
                            uuid: service.uuid,
                            name: service.name,
                            type: service.type,
                            includedServiceUuids: service.includedServiceUuids
                        };
                        if (service.characteristics && service.characteristics.length > 0) {
                            serviceInfo.characteristics = {};
                            service.characteristics.forEach(function(characteristic) {
                                var charInfo = {
                                    uuid: characteristic.uuid,
                                    name: characteristic.name,
                                    type: characteristic.type,
                                    properties: characteristic.properties,
                                    descriptors: characteristic.descriptors
                                };
                                serviceInfo.characteristics[charInfo.uuid] = charInfo;
                            });
                        }
                        device.services[serviceInfo.uuid] = serviceInfo;
                    });
                    if (callback) {
                        callback(true);
                    }
                }
            });
        }
    });
}

// system stuff

process.on('SIGINT', function() {
    if (noble) {
        noble.stopScanning();
    }
});

module.exports = bluetoothManager;