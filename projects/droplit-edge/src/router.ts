import * as async from 'async';         // import npm module
import * as cache from './cache';       // import local module
import * as debug from 'debug';         // import npm module
import * as DP from 'droplit-plugin';   // import npm linked module
import * as plugin from './plugin';     // import local module
import Transport from './transport';    // import local module, used as the websocket connectivity layer between cloud and edge router.
import { Network } from './network';
// Import types

import {
    CallMethodResponse,
    DeviceCommand,
    DeviceInfo,
    DeviceMessage,
    DeviceMessageResponse,
    EventRaised,
    GetPropertiesResponse,
    PluginData,
    PluginMessage,
    PluginMessageResponse,
    PluginSetting,
    PluginSettingResponse,
    RequestMethodResponse,
    SetPropertiesResponse
} from './types/types';

const log = debug('droplit:router');                                         // initilize logging module for log levels
const logv = debug('droplit-v:router');                                      // initilize verbose logging
const settings = require('../settings.json');                                // Load settings file
const localSettings = require('../localsettings.json');                      // Load local settings file

// log to file
if (localSettings.debug && localSettings.debug.logToFile && localSettings.debug.logPath) {
    const fs = require('fs');
    const path = require('path');
    let { logPath } = localSettings.debug;
    if (!path.isAbsolute(localSettings.debug.logPath)) {
        logPath = path.join(process.cwd(), logPath);
    }
    if (fs.existsSync(path.join(logPath, '../'))) {
        if (!fs.existsSync(logPath)) {
            fs.mkdirSync(logPath);
        }
        log('logging output to:', logPath);
        const access = fs.createWriteStream(path.join(logPath, `droplitlog_${(new Date()).toISOString().replace(/:/g, '-').replace('T', '_').replace('.', '-')}.txt`));
        const fn = process.stderr.write;
        /* tslint:disable no-function-expression */
        process.stderr.write = <any>function () {
            access.write.apply(access, arguments);
            fn.apply(process.stderr, arguments);
        };
        /* tslint:disable no-function-expression */
    } else {
        log('log file path does not exist:', logPath);
    }
}

export { Transport };                                                        // export Transport interface
export const macAddress: string =                                                    // use node-getmac library to get hardware mac address, used to uniquely identify this device
    localSettings.config && localSettings.config.MACAddressOverride ? localSettings.config.MACAddressOverride : null || // Override UID retrieval
        require('./node-getmac').trim() ||
        undefined;

// Uncomment to detect/debug unhandled rejection warning
// const process = require('process');
// process.on('unhandledRejection', (reason: any, p: any) => {
//     console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
// });

declare const Map: any; // Work-around typescript not knowing Map when it exists for the JS runtime

export const plugins = new Map();                       // Create hashmap of plugins
export const transport = new Transport();               // Create a new instance of the transport layer

let autodiscoverTimer: number;                          // Device auto discovery timer
let hasConnected = false;                               // Has Transport layer connected, used first time connection

// overwrite settings with local settings
Object.keys(localSettings).forEach(key => settings[key] = localSettings[key]);

// Amount of time (ms) to wait before turning on auto discover
const AutoDiscoverDelay = 2 * 60 * 1000;
// Determine if auto discover should run
const AutoDiscover = (settings.router && settings.router.autodiscover) ? settings.router.autodiscover : true;
// Amount of time (ms) between discovery attempts
const AutoDiscoverCadence = (settings.router && settings.router.autodiscoverCadence) ?
    settings.router.autodiscoverCadence : 60000;
// Amount of time (ms) for device to respond
const GetPropertyTimeout = 3000;
// Amount of time (ms) to cascade plugin discovery
const PluginDiscoveryCascade = 2000;

logv(`AutoDiscoverDelay: ${AutoDiscoverDelay / 1000}s`);
logv(`AutoDiscoverCadence: ${AutoDiscoverCadence / 1000}s`);
logv(`GetPropertyTimeout: ${GetPropertyTimeout / 1000}s`);
logv(`PluginDiscoveryCascade: ${PluginDiscoveryCascade / 1000}s`);

// log select settings
log(`using setting host: ${settings.transport.host}`);
log(`using setting ecosystem: ${settings.ecosystemId}`);
log(`using setting edge id: ${macAddress}`);

// If enabled, generates a heap dump on a set interval for diognostic purposes
if (settings.debug && settings.debug.generateHeapDump) {
    const heapdump = require('heapdump');
    const heapInterval = 30 * 60 * 1000;
    const writeSnapshot = () => {
        // Creates the snapshot file named with the current time
        heapdump.writeSnapshot(`droplit-${Date.now()}.heapsnapshot`, (err: any, filename: string) => {
            if (err) {
                log('error writing heap snapshot:', err);
                return;
            }
            log(`wrote heap snaphot: ${filename}`);
        });
    };

    writeSnapshot.bind(this)();
    setInterval(writeSnapshot.bind(this), heapInterval);
}

// WARNING: Diagnostics is meant for internal troubleshooting only, enabling may have security implications
// If diagnostics enabled, load local diognostics module
if (settings.diagnostics && settings.diagnostics.enabled)
    require('./diagnostics')(this);

log(`config: ${JSON.stringify(localSettings.config) || 'No localSettings.config'}`);
if (localSettings.config && localSettings.config.provisioningServiceEnabled) {
    Network(macAddress);
}

// Load plugins
loadPlugins().then(() => {
    // Initialize the transport
    const headers: { [k: string]: string } = { 'x-edge-id': macAddress };
    if (settings.ecosystemId) {
        headers['x-ecosystem-id'] = settings.ecosystemId;
    }
    transport.start(settings.transport, headers);
});

// Transport event handlers
transport.once('connected', () => {
    hasConnected = true;
    discoverAll();
    if (AutoDiscover)
        setTimeout(startAutodiscover.bind(this), AutoDiscoverDelay);
});

// Unimplemented transport event
transport.on('disconnected', () => { });

// When device message recieved from cloud
transport.on('#device message', (message: DeviceMessage, cb: (response: any) => void) => {
    let result: DeviceMessageResponse;
    if (message)
        result = sendDeviceMessage(message);
    if (cb)
        cb(result);
});

// Unimplemented discover request
transport.on('#discover', (data: any) => { });

// Hello message sent from cloud
transport.on('#ehlo', (data: any, cb: (response: any) => void) => { if (cb) cb('ack'); });

// Message to drop discovered device
transport.on('#drop', (data: any) => {
    if (data)
        dropDevice(data);
});

// Call a device method
transport.on('#method call', (data: any, cb: (response: any) => void) => {
    // Wrap single method in an array
    let results: CallMethodResponse;
    if (!Array.isArray(data) && typeof data === 'object')
        data = [data];

    if (data)
        results = callMethods(data);

    if (cb)
        cb(results);
});

transport.on('#method request', (data: any, cb: (response: any) => void) => {
    // Wrap single property in an array
    if (!Array.isArray(data) && typeof data === 'object')
        data = [data];
    if (data && cb)
        requestMethods(data).then(results => cb(results));
});

transport.on('#plugin setting', (data: PluginSetting[], cb: (response: any) => void) => {
    let results: PluginSettingResponse;

    if (data)
        results = setPluginSetting(data);

    if (cb)
        cb(results);
});

// Unimplemented plugin data event
transport.on('#plugin data', (data: PluginData[], cb: (response: any) => void) => { });

// Unimplemented plugin data event
transport.on('#plugin message', (data: PluginMessage, cb: (response: any) => void) => {
    let results: PluginMessageResponse;
    if (data)
        results = sendPluginMessage(data);
    if (cb)
        cb(results);
});

// Cloud requests property value
transport.on('#property get', (data: any, cb: (response: any) => void) => {
    // Wrap single property in an array
    if (!Array.isArray(data) && typeof data === 'object')
        data = [data];
    if (data && cb)
        getProperties(data).then(results => cb(results));
});

// Cloud sets device property value
transport.on('#property set', (data: any, cb: (response: any) => void) => {
    let results: SetPropertiesResponse;
    // Wrap single property in an array
    if (!Array.isArray(data) && typeof data === 'object')
        data = [data];
    if (data)
        results = setProperties(data);
    if (cb)
        cb(results);
});

// Implementaions

// calls device methods
function callMethods(commands: DeviceCommand[]): CallMethodResponse {
    log(`call > ${JSON.stringify(commands)}`);
    const map = groupByPlugin(commands);    // Group batch of commands into a map
    const results: CallMethodResponse = {
        supported: Array.apply(null, Array(commands.length)) // init all values to undefined
    };
    Object.keys(map).forEach(pluginName => {
        // send commands to plugin
        results.supported = plugin.instance(pluginName).callMethods(map[pluginName]);
    });
    return results;
}

// TODO: Unimplemented. delete?
// function discover(pluginName?: string) {
//     if (pluginName)
//         return discoverOne(pluginName);
//     discoverAll();
// }

// Tells plugins to start discovering devices, staggers them by 2000 ms
function discoverAll() {
    let timeout = 0;
    plugins.forEach((plugin: plugin.Controller) => {
        setTimeout(plugin => {
            logv(`Starting discover with plugin: ${plugin.pluginName}`);
            plugin.discover();
        }, timeout, plugin);
        timeout += PluginDiscoveryCascade;
    });
}

// TODO: Unimplemented. delete?
// function discoverOne(pluginName: string) {
//     if (!plugins.has(pluginName))
//         return;
//     plugins.get(pluginName).discover();
// }

// Removes discovered device instance
function dropDevice(commands: DeviceCommand[]) {
    log(`drop > ${JSON.stringify(commands)}`);
    const map = groupByPlugin(commands);

    Object.keys(map).forEach(pluginName => {
        map[pluginName].forEach(device => {
            plugin.instance(pluginName).dropDevice(device.localId);
            cache.removeByLocalId(device.localId);      /// Removes the device from the edge local id cache
        });
    });
}

// Utility to parse command to find the plugin name
function getPluginName(command: DeviceCommand) {
    if (command.deviceId === '.')
        return cache.getServicePlugin(command.service);

    const local = cache.getDeviceByLocalId(command.localId);
    if (local)
        return local.pluginName;

    const device = cache.getDeviceByDeviceId(command.deviceId);
    if (device)
        return device.pluginName;

    return null;
}

// used when doing a forced refresh
function getProperties(commands: DeviceCommand[]): Promise<GetPropertiesResponse> {
    log(`get > ${JSON.stringify(commands)}`);
    const map: { [pluginName: string]: DP.DeviceServiceMember[] } = groupByPlugin(commands);
    const results: GetPropertiesResponse = {
        supported: Array.apply(null, Array(commands.length)), // init all values to undefined
        values: Array.apply(null, Array(commands.length)) // init all values to undefined
    };

    // assuming openFiles is an array of file names
    return new Promise<GetPropertiesResponse>((resolve, reject) => {

        // If the device information does not return in the alloted time, return what we have with an error
        const failedMessageError: Error = {
            message: `The request could not be fufilled or fully fufilled. Command information: ${JSON.stringify(map)} Current results: ${JSON.stringify(results)}`,
            name: `Device Property Get`,
        };
        logv(failedMessageError.message, failedMessageError.name);
        const timer = setTimeout(() => sendResponse(failedMessageError), GetPropertyTimeout);

        // Go through each mapped command and get the results
        async.each(Object.keys(map), (pluginName: string, cb: () => void) => {
            let sectionValues: DP.DeviceServiceMember[];
            const pluginIndexes = map[pluginName].map(member => (member as any)._sequence);
            const sectionSupported = plugin.instance(pluginName).getProperties(map[pluginName], values => {
                sectionValues = values;
                if (sectionValues) {
                    sectionValues.forEach((result, index) => {
                        results.values[pluginIndexes[index]] = result;
                    });
                }
                cb();
            });
            if (sectionSupported) {
                sectionSupported.forEach((result, index) => {
                    results.supported[pluginIndexes[index]] = result;
                });
            }
        }, sendResponse);

        // finally, send a response
        function sendResponse(err: Error) {
            clearTimeout(timer);
            if (err)
                log(err);
            log(`get < ${JSON.stringify(results)}`);
            resolve(results);
        }
    });
}

function getServiceMember(command: DeviceCommand): DP.DeviceServiceMember {
    if (command.deviceId === '.') command.localId = command.deviceId;
    const deviceInfo = cache.getDeviceByDeviceId(command.deviceId);
    // HACK: Allows easier testing via wscat
    const localId = command.localId || (deviceInfo ? deviceInfo.localId : null);
    if (!localId) // HACK: This is here to help debug the circumstances under which there is no localId.
        log(`WARNING: Cannot find localId for command: ${JSON.stringify(command)}`);
    const results = {
        localId,
        address: deviceInfo ? deviceInfo.address : null,
        service: command.service,
        index: command.index,
        member: command.member,
        value: command.value
    };
    if (command.hasOwnProperty('_sequence'))
        (results as any)._sequence = (command as any)._sequence;
    return results;
}

function groupByPlugin(commands: DeviceCommand[]): { [pluginName: string]: DP.DeviceServiceMember[] } {
    const map: { [pluginName: string]: DP.DeviceServiceMember[] } = {};
    commands.forEach((command, index) => {
        (<any>command)._sequence = command.commandIndex; // preserve the original sequence number
        const pluginName = getPluginName(command);
        if (pluginName) {
            map[pluginName] = map[pluginName] || [];
            map[pluginName].push(getServiceMember(command));
        }
    });
    return map;
}

function loadPlugin(pluginName: string) {
    return new Promise((resolve, reject) => {
        setImmediate(() => {
            const pluginController = plugin.instance(pluginName);
            if (!pluginController)
                return resolve();

            log(`${pluginName} loaded`);

            pluginController.on('device info', (deviceInfo: DeviceInfo, callback?: (deviceInfo: DP.DeviceInfo) => {}) => {
                deviceInfo.pluginName = pluginName;
                cache.setDeviceInfo(deviceInfo);
                log(`info < ${deviceInfo.pluginName}:${deviceInfo.localId}`);
                transport.sendRequestReliable('device info', deviceInfo, (response, err) => deviceInfoResponseHandler(response, err, deviceInfo, callback));
            });

            pluginController.on('event raised', (events: EventRaised[]) => {
                events = Array.isArray(events) ? events : [events];
                events.reduce((p, c) => {
                    const d = cache.getDeviceByLocalId(c.localId);
                    const message = (d && d.pluginName) ? `event < ${d.pluginName}:${d.localId}` :
                                    d ? `event < unknown:${d.localId}` :
                                    `event < unknown`;
                    log(message);
                    if (d && d.pluginName)
                        c.pluginName = d.pluginName;
                    return p.concat([c]);
                }, []);
                transport.send('event raised', events, err => { });
            });

            pluginController.on('property changed', (properties: any[]) => {
                properties = Array.isArray(properties) ? properties : [properties];
                properties.reduce((p, c) => {
                    const d = cache.getDeviceByLocalId(c.localId);
                    const valueOutput = c.value && typeof c.value === 'object' && !Array.isArray(c.value) ? JSON.stringify(c.value) : c.value;
                    log(`pc < ${c.localId}\\${c.service}.${c.member} ${valueOutput}`);
                    if (d && d.pluginName)
                        c.pluginName = d.pluginName;
                    return p.concat([c]);
                }, []);

                // Only guarentee if send before first connect
                if (!hasConnected)
                    transport.sendReliable('property changed', properties);
                else
                    transport.send('property changed', properties, err => { });
            });

            const basicSend = (event: string) => (data: any) => transport.send(event, data, err => basicSend('log error'));

            pluginController.on('discover complete', (events: any[]) => {
                logv(`plugin: ${pluginName} : discover complete`, events);
                basicSend('discover complete')(events);
            });
            pluginController.on('log info', (events: any[]) => {
                events.forEach(event => event.pluginName = pluginController.getName());
                logv(`plugin: ${pluginName} : log info`, events);
                basicSend('log info')(events);
            });
            pluginController.on('log error', (events: any[]) => {
                events.forEach(event => event.pluginName = pluginController.getName());
                logv(`plugin: ${pluginName} : log error`, events);
                basicSend('log error')(events);
            });
            pluginController.on('plugin data', (events: any[]) => {
                logv(`plugin: ${pluginName} : plugin data`, events);
                basicSend('plugin data')(events);
            });
            pluginController.on('plugin setting', (event: any) => {
                pluginController.setSetting(event);
                logv(`plugin: ${pluginName} : plugin data`, event);
                // basicSend('plugin setting')(event);
            });
            plugins.set(pluginName, pluginController);

            resolve();
        });
    });
}

function deviceInfoResponseHandler(response: any, err: any, deviceInfo: any, callback?: (deviceInfo: DP.DeviceInfo) => {}) {
    if (!response)
        return;
    const refreshedInfo: DP.DeviceInfo = JSON.parse(response);
    if (!response) {
        log(`loadPlugin: device info: no device information returned in packet:`, err);
        return;
    }
    log(`id > ${deviceInfo.localId} -> ${(refreshedInfo as any).deviceId}`);
    cache.setDeviceInfo(refreshedInfo);
    if (callback)
        callback(refreshedInfo);
}

function loadPlugins() {
    return new Promise((resolve, reject) => {
        log('load plugins');
        if (!settings.plugins || !(Array.isArray(settings.plugins) || typeof settings.plugins === 'object')) {
            log('no plugins found');
            return resolve();
        }

        const plugins: string[] = [];
        const pluginSettings: PluginSetting[] = [];
        const localDeviceInfo: DP.DeviceInfo = {
            localId: '.',
            services: [],
            promotedMembers: {}
        };
        // Array format
        if (Array.isArray(settings.plugins)) {
            settings.plugins.forEach((plugin: string | any) => {
                if (typeof plugin === 'string')
                    return plugins.push(plugin);

                if (typeof plugin === 'object') {
                    if (!plugin.name) {
                        log('cannot load nameless plugin', plugin);
                        return;
                    }
                    if (plugin.enabled !== false) {
                        plugins.push(plugin.name);
                        if (plugin.localServices && Array.isArray(plugin.localServices)) {
                            plugin.localServices.forEach((service: any) => {
                                if (typeof service !== 'string') {
                                    log('localService name is malformatted', service);
                                    return;
                                }
                                cache.setServicePlugin(service, plugin.name);
                                localDeviceInfo.services.push(service);
                            });
                        }
                        return;
                    }
                    log(`plugin ${plugin.name} is not enabled — skipping`);
                    return;
                }
                log('plugin syntax is neither a string nor an object');
            });
        }
        // Object format
        else if (typeof settings.plugins === 'object') {
            Object.keys(settings.plugins).forEach(plugin => {
                if (settings.plugins[plugin].enabled === false)
                    return;
                if (settings.plugins[plugin].settings) {
                    Object.keys(settings.plugins[plugin].settings).forEach(key => {
                        pluginSettings.push({
                            plugin,
                            key,
                            value: settings.plugins[plugin].settings[key]
                        });
                    });
                }
                plugins.push(plugin);
                if (Array.isArray(settings.plugins[plugin].localServices)) {
                    (settings.plugins[plugin].localServices as [any]).forEach(ls => {
                        cache.setServicePlugin(ls, plugin);
                        localDeviceInfo.services.push(ls);
                    });
                }
            });
        }

        // Only emit local info if it has any services
        if (localDeviceInfo.services.length > 0) {
            Object.keys(settings.promotedMembers || {}).forEach(member =>
                localDeviceInfo.promotedMembers[member] = settings.promotedMembers[member]);

            cache.setDeviceInfo(localDeviceInfo);
            log(`local info < ${localDeviceInfo.services}:${localDeviceInfo.localId}`);
            transport.sendRequestReliable('device info', localDeviceInfo, (response, err) => deviceInfoResponseHandler(response, err, localDeviceInfo));
        }

        const promises = plugins.map(name => (): Promise<any> => loadPlugin(name));
        const all = promises.reduce((p, c) =>
            p.then(() =>
                new Promise((res, rej) =>
                    c().then(res).catch(rej)
                )
            ), Promise.resolve(undefined));
        all.then(() => {
            setPluginSetting(pluginSettings);
            resolve();
        });
    });
}

function requestMethods(commands: DeviceCommand[]): Promise<RequestMethodResponse> {
    log(`request > ${JSON.stringify(commands)}`);

    const map: { [pluginName: string]: DP.DeviceServiceMember[] } = groupByPlugin(commands);
    const results: GetPropertiesResponse = {
        supported: Array.apply(null, Array(commands.length)), // init all values to undefined
        values: Array.apply(null, Array(commands.length)) // init all values to undefined
    };

    return new Promise<RequestMethodResponse>((resolve, reject) => {
        // If the device information does not return in the alloted time, return what we have with an error
        const failedMessageError: Error = {
            message: `The request could not be fufilled or fully fufilled. Command information: ${JSON.stringify(map)} Current results: ${JSON.stringify(results)}`,
            name: `Device Method Request`,
        };
        logv(failedMessageError.message, failedMessageError.name);
        const timer = setTimeout(() => sendResponse(failedMessageError), GetPropertyTimeout);

        // Go through each mapped command and get the results
        async.each(Object.keys(map), (pluginName: string, cb: () => void) => {
            let sectionValues: DP.DeviceServiceMember[];
            const pluginIndexes = map[pluginName].map(member => (member as any)._sequence);
            const sectionSupported = plugin.instance(pluginName).requestMethods(map[pluginName], values => {
                sectionValues = values;
                if (sectionValues) {
                    sectionValues.forEach((result, index) => {
                        results.values[pluginIndexes[index]] = result;
                    });
                }
                cb();
            });
            if (sectionSupported) {
                sectionSupported.forEach((result, index) => {
                    results.supported[pluginIndexes[index]] = result;
                });
            }
        }, sendResponse);

        function sendResponse(err: Error) {
            clearTimeout(timer);
            if (err)
                log(err);
            log(`request < ${JSON.stringify(results)}`);
            resolve(results);
        }
    });
}

function sendDeviceMessage(message: DeviceMessage): DeviceMessageResponse {
    log(`msg > ${JSON.stringify(message)}`);
    const device: any = cache.getDeviceByDeviceId(message.deviceId);
    const deviceId = message.deviceId;
    const data = message.message;

    if (device && device.pluginName)
        return plugin.instance(device).deviceMessage(deviceId, data, () => {
            // emit device message response through some manner
        });

    return { supported: false };
}

export function sendPluginMessage(message: PluginMessage, callback?: (value: any) => void): PluginMessageResponse {
    log(`plug msg > ${JSON.stringify(message)}`);
    const p = plugin.instance(message.plugin);
    if (!p)
        return { supported: false };

    return p.pluginMessage(message.message, value => {
        if (callback)
            callback(value);
        // TODO: emit device message response through some manner
    });
}

// TODO: Unimplemented. delete?
// function setPluginData(settings: PluginData[]): PluginDataResponse {
//     let results: PluginDataResponse = {
//         supported: Array.apply(null, Array(settings.length))
//     };
//     results.supported = settings.reduce(function (p, c) {
//         if (c && c.key && c.plugin && c.value) {
//             cache.setPluginData(c.plugin, c.key, c.value);
//             plugin.instance(c.plugin).emit('plugin data', c);
//             return p.concat([true]);
//         }
//         return p.concat([false]);
//     }, []);
//     return results;
// }

function setPluginSetting(settings: PluginSetting[]): PluginSettingResponse {
    const results: PluginSettingResponse = {
        supported: Array.apply(null, Array(settings.length)) // init all values to undefined
    };
    results.supported = settings.reduce((p, c) => {
        if (c && c.key && c.plugin && c.value) {
            cache.setPluginSetting(c.plugin, c.key, c.value);
            plugin.instance(c.plugin).emit('plugin setting', c);
            return p.concat([true]);
        }
        return p.concat([false]);
    }, []);
    return results;

}

function setProperties(commands: DeviceCommand[]): SetPropertiesResponse {
    log(`set > ${JSON.stringify(commands)}`);
    const map = groupByPlugin(commands);
    const results: SetPropertiesResponse = {
        supported: Array.apply(null, Array(commands.length))
    };

    Object.keys(map).forEach(pluginName => {
        // send commands to plugin
        const sectionResults = plugin.instance(pluginName).setProperties(map[pluginName]);
        const pluginIndexes = map[pluginName].map(member => (member as any)._sequence);

        if (sectionResults) {
            // reorganize the results to the original sequence
            sectionResults.forEach((result, index) => {
                results.supported[pluginIndexes[index]] = result;
            });
        }
    });
    return results;
}

/// Runs discover all on a timer
function startAutodiscover() {
    // Already auto-discovering
    if (autodiscoverTimer)
        return;
    logv('Starting autodiscover interval...');
    // First auto should be immediate
    discoverAll.bind(this)();
    autodiscoverTimer = setInterval(discoverAll.bind(this), AutoDiscoverCadence);
}

/*
    There are a fair bit of magic numbers that should be pulled out to the top.
    This file is pretty long and should refactored. The command utilities and implenentations can be moved into a seperate file.
    Several event handlers are un implemented. They should at least call the log.
    Also several of the methods are out of order.
*/