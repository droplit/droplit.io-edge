import * as async from 'async';
import * as cache from './cache';
import * as debug from 'debug';
import * as DP from 'droplit-plugin';
import * as plugin from './plugin';
import Transport from './transport';
import {
    CallMethodResponse,
    DeviceCommand,
    DeviceInfo,
    DeviceMessage,
    DeviceMessageResponse,
    EventRaised,
    GetPropertiesResponse,
    PluginData,
    PluginSetting,
    PluginSettingResponse,
    SetPropertiesResponse
} from './types/types';

const log = debug('droplit:router');
export { Transport };
const macAddress = require('node-getmac').trim();

declare var Map: any; // Work-around typescript not knowing Map when it exists for the JS runtime

// Amount of time (ms) to wait before turning on auto discover
const AutoDiscoverDelay = 2 * 60 * 1000;
// Amount of time (ms) between discovery attempts
const AutoDiscoverCadence = 60000;

const GetPropertyTimeout = 3000;

const localSettings = require('../localsettings.json');
const plugins = new Map();
const settings = require('../settings.json');
const transport = new Transport();

let autodiscoverTimer: number;
let hasConnected = false;

// overwrite settings with local settings
Object.keys(localSettings).forEach((key) => settings[key] = localSettings[key]);

// If enabled, generates a heap dump on a set interval
if (settings.debug.generateHeapDump) {
    const heapdump = require('heapdump');
    const heapInterval = 30 * 60 * 1000;
    const writeSnapshot = () => {
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

loadPlugins().then(() => {
    // Initialize the transport
    transport.start(settings.transport, {
        'x-edge-id': macAddress,
        'x-ecosystem-id': settings.ecosystemId // requires ecosystemId to be set in localsettings.json
    });
});

// Transport event handlers
transport.once('connected', () => {
    hasConnected = true;
    discoverAll();
    if (settings.router.autodiscover)
        setTimeout(startAutodiscover.bind(this), AutoDiscoverDelay);
});

transport.on('disconnected', () => { });

transport.on('#device message', (message: DeviceMessage, cb: (response: any) => void) => {
    let result: DeviceMessageResponse;
    if (message)
        result = sendDeviceMessage(message);

    if (cb)
        cb(result);
});

transport.on('#discover', (data: any) => { });

transport.on('#ehlo', (data: any, cb: (response: any) => void) => { if (cb) cb('ack'); });

transport.on('#drop', (data: any) => {
    if (data)
        dropDevice(data);
});

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

transport.on('#plugin setting', (data: PluginSetting[], cb: (response: any) => void) => {
    let results: PluginSettingResponse;

    if (data)
        results = setPluginSetting(data);

    if (cb)
        cb(results);
});

transport.on('#plugin data', (data: PluginData[], cb: (response: any) => void) => { });

transport.on('#property get', (data: any, cb: (response: any) => void) => {
    // Wrap single property in an array
    if (!Array.isArray(data) && typeof data === 'object')
        data = [data];

    if (data && cb)
        getProperties(data).then(results => cb(results));
});

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

function callMethods(commands: DeviceCommand[]): CallMethodResponse {
    log(`call > ${JSON.stringify(commands)}`);
    const map = groupByPlugin(commands);
    const results: CallMethodResponse = {
        supported: Array.apply(null, Array(commands.length)) // init all values to undefined
    };
    log(`call: generated some map:`, map);
    Object.keys(map).forEach(pluginName => {
        // send commands to plugin
        debug(`Calling methods for ${pluginName}`);
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

function discoverAll() {
    let timeout = 0;
    plugins.forEach((plugin: any) => {
        setTimeout(plugin => {
            plugin.discover();
        }, timeout, plugin);
        timeout += 2000;
    });
}

// TODO: Unimplemented. delete?
// function discoverOne(pluginName: string) {
//     if (!plugins.has(pluginName))
//         return;
//     plugins.get(pluginName).discover();
// }

function dropDevice(commands: DeviceCommand[]) {
    log(`drop > ${JSON.stringify(commands)}`);
    const map = groupByPlugin(commands);

    Object.keys(map).forEach(pluginName => {
        map[pluginName].forEach(device => {
            plugin.instance(pluginName).dropDevice(device.localId);
            cache.removeByLocalId(device.localId);
        });
    });
}

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
    // log(`getServiceMember: command`, command);
    const deviceInfo = cache.getDeviceByDeviceId(command.deviceId);
    // log(`getServiceMember: deviceInfo`, deviceInfo);
    // HACK: Allows easier testing via wscat
    const localId = command.localId || deviceInfo.localId;
    // log(`getServiceMember: localinfo`, localId);
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
        // log(`groupByPlugin:`, pluginName, `for command`, command);
    });
    return map;
}

function loadPlugin(pluginName: string) {
    return new Promise<any>((resolve, reject) => {
        setImmediate(() => {
            const p = plugin.instance(pluginName);
            if (!p)
                return resolve();

            log(`${pluginName} loaded`);

            p.on('device info', (deviceInfo: DeviceInfo, callback?: (deviceInfo: DP.DeviceInfo) => {}) => {
                deviceInfo.pluginName = pluginName;
                // after we store the information in the cache, we swap '.'
                // for the hub MACaddress if necessary
                // if (deviceInfo.localId === '.') deviceInfo.localId = macAddress;
                cache.setDeviceInfo(deviceInfo);

                log(`info < ${deviceInfo.pluginName}:${deviceInfo.localId}`);
                transport.sendRequestReliable('device info', deviceInfo, (response, err) => deviceInfoResponseHandler(response, err, deviceInfo, callback));
            });

            p.on('event raised', (events: EventRaised[]) => {
                // console.log(`event raised`);
                debug(`events: ${JSON.stringify(events)}`);
                events.reduce((p, c) => {
                    // console.log(`${p} raised an event ${JSON.stringify(c)}`);
                    const d = cache.getDeviceByLocalId(c.localId);
                    log(`event < ${d.pluginName}:${d.localId}`);
                    if (d.pluginName)
                        c.pluginName = d.pluginName;
                    return p.concat([c]);
                }, []);
                // console.log(`events: ${JSON.stringify(events)}`);
                transport.send('event raised', events, err => { });
            });

            p.on('property changed', (properties: any[]) => {
                properties.reduce((p, c) => {
                    // console.log(`${p} raised an event`, c,
                    //     '\nlocal', cache.getDeviceByLocalId(c.localId),
                    //     '\nmac', cache.getDeviceByLocalId(macAddress),
                    //     '\nretrieved', cache.getDeviceByLocalId(c.localId),
                    //     '\npluginNaMe', p.pluginName);
                    // if (c.localId === '.') c.localId = macAddress;                          // update to MAC address
                    const d = cache.getDeviceByLocalId(c.localId);
                    log(`pc < ${c.localId}\\${c.service}.${c.member} ${c.value}`);
                    if (d.pluginName)
                        c.pluginName = d.pluginName;
                    return p.concat([c]);
                }, []);

                // Only guarentee if send before first connect
                // console.log(`changed props: ${JSON.stringify(properties)}`);
                if (!hasConnected)
                    transport.sendReliable('property changed', properties);
                else
                    transport.send('property changed', properties, err => { });
            });

            const basicSend = (event: string) => (data: any) => transport.send(event, data, err => { });

            p.on('discover complete', basicSend('discover complete'));
            p.on('log info', basicSend('log info'));
            p.on('log error', basicSend('log error'));
            p.on('plugin data', basicSend('plugin data'));
            p.on('plugin setting', basicSend('plugin setting'));

            plugins.set(pluginName, p);

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
                    if (!plugin.name)
                        return;
                    if (plugin.enabled !== false) {
                        plugins.push(plugin.name);
                        if (plugin.localServices && Array.isArray(plugin.localServices)) {
                            plugin.localServices.forEach((service: string) => {
                                cache.setServicePlugin(service, plugin.name);
                                localDeviceInfo.services.push(service);
                            });
                        }
                    }
                }
            });
        }
        // Object format
        else if (typeof settings.plugins === 'object') {
            Object.keys(settings.plugin).forEach(plugin => {
                if (settings.plugins[plugin].enabled === false)
                    return;
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
            Object.keys(settings.promotedMembers).forEach(member =>
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
            ), Promise.resolve<any>(undefined));

        all.then(() => resolve());
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

    // log(`setProperties: mapped:`, map);
    Object.keys(map).forEach(pluginName => {
        // send commands to plugin
        const sectionResults = plugin.instance(pluginName).setProperties(map[pluginName]);
        const pluginIndexes = map[pluginName].map(member => (member as any)._sequence);
        // log(`plugin:`, pluginName, map[pluginName]);
        // log(`results:`, sectionResults);

        if (sectionResults) {
            // reorganize the results to the original sequence
            sectionResults.forEach((result, index) => {
                // log(`results [${index}]:`, result);
                results.supported[pluginIndexes[index]] = result;
            });
        }
    });
    return results;
}

function startAutodiscover() {
    // Already auto-discovering
    if (autodiscoverTimer)
        return;

    // First auto should be immediate
    discoverAll.bind(this)();
    autodiscoverTimer = setInterval(discoverAll.bind(this), AutoDiscoverCadence);
}
