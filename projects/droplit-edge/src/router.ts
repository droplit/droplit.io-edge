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
    LogError,
    LogInfo,
    PluginData,
    PluginDataResponse,
    PluginSetting,
    PluginSettingResponse,
    SetPropertiesResponse
} from './types/types';

let log = debug('droplit:router');
export {Transport};

declare var Map: any; // Work-around typescript not knowing Map when it exists for the JS runtime

// Amount of time (ms) to wait before turning on auto discover
const AutoDiscoverDelay = 2 * 60 * 1000;
// Amount of time (ms) between discovery attempts
const AutoDiscoverCadence = 60000;

const GetPropertyTimeout = 3000;
const DiscoverAllStagger = 2000;

const localSettings = require('../localsettings.json');
const plugins = new Map();
const settings = require('../settings.json');
const transport = new Transport();

let autodiscoverTimer: number;

// overwrite settings with local settings
Object.keys(localSettings).forEach((key) => settings[key] = localSettings[key]);

// If enabled, generates a heap dump on a set interval
if (settings.debug.generateHeapDump) {
    const heapdump = require('heapdump');
    const heapInterval = 30 * 60 * 1000;

    writeSnapshot.bind(this)();
    setInterval(writeSnapshot.bind(this), heapInterval);

    function writeSnapshot() {
        heapdump.writeSnapshot(`droplit-${Date.now()}.heapsnapshot`, (err: any, filename: string) => {
            if (err) {
                log('error writing heap snapshot:', err);
                return;
            }
            log(`wrote heap snaphot: ${filename}`);
        });
    }
}

// Initialize the transport
let mac = require('getmac');
mac.getMac((err: Error, macAddress: string) => {
    if (err)
        throw err;
    transport.start(settings.transport, {
        'x-edge-id': macAddress,
        'x-ecosystem-id': settings.ecosystemId // requires ecosystemId to be set in localsettings.json
    });
});

// Transport event handlers
transport.once('connected', () => {
    loadPlugins();
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
    let map = groupByPlugin(commands);
    let results: CallMethodResponse = {
        supported: Array.apply(null, Array(commands.length)) // init all values to undefined
    };
    Object.keys(map).forEach(pluginName => {
        // send commands to plugin
        results.supported = plugin.instance(pluginName).callMethods(map[pluginName]);
    });
    return results;
}

function discover(pluginName?: string) {
    if (pluginName)
        return discoverOne(pluginName);
    discoverAll();
}

function discoverAll() {
    let timeout = 0;
    plugins.forEach((plugin: any) => {
        setTimeout(plugin => {
            plugin.discover();
        }, timeout, plugin);
        timeout += 2000;
    });
}

function discoverOne(pluginName: string) {
    if (!plugins.has(pluginName))
        return;
    plugins.get(pluginName).discover();
}

function dropDevice(commands: DeviceCommand[]) {
    let map = groupByPlugin(commands);
    
    Object.keys(map).forEach(pluginName => {
        map[pluginName].forEach(device => plugin.instance(pluginName).dropDevice(device.localId));
    });
}

function getPluginName(command: DeviceCommand) {
    // HACK: Allows easier testing via wscat
    let local = cache.getDeviceByLocalId(command.localId);
    if (local)
        return local.pluginName;

    let device = cache.getDeviceByDeviceId(command.deviceId);
    if (device)
        return device.pluginName;

    return null;
}

function getProperties(commands: DeviceCommand[]): Promise<GetPropertiesResponse> {
    log(`get > ${JSON.stringify(commands)}`);
    let map: { [pluginName: string]: DP.DeviceServiceMember[] } = groupByPlugin(commands);
    let results: GetPropertiesResponse = {
        supported: Array.apply(null, Array(commands.length)), // init all values to undefined
        values: Array.apply(null, Array(commands.length)) // init all values to undefined
    };

    // assuming openFiles is an array of file names
    return new Promise<GetPropertiesResponse>((resolve, reject) => {

        // If the device information does not return in the alloted time, return what we have with an error
        let failedMessageError: Error = {
            message: `The request could not be fufilled or fully fufilled. Command information: ${JSON.stringify(map)} Current results: ${JSON.stringify(results)}`,
            name: `Device Property Get`,
        };
        let timer = setTimeout(() => sendResponse(failedMessageError), GetPropertyTimeout);

        // Go through each mapped command and get the results
        async.each(Object.keys(map), (pluginName: string, cb: () => void) => {
            let sectionValues: DP.DeviceServiceMember[];
            let sectionSupported = plugin.instance(pluginName).getProperties(map[pluginName], values => {
                sectionValues = values;
                if (sectionValues) {
                    sectionValues.forEach((result, index) => {
                        let resultIndex = (<any>map)._sequence || 0;
                        results.values[resultIndex] = result;
                    });
                }
                cb();
            });
            if (sectionSupported) {
                sectionSupported.forEach((result, index) => {
                    let resultIndex = (<any>map)._sequence || 0;
                    results.supported[resultIndex] = result;
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
    // log(`getServiceMember: command`, command);
    let deviceInfo = cache.getDeviceByDeviceId(command.deviceId);
    // log(`getServiceMember: deviceInfo`, deviceInfo);
    // HACK: Allows easier testing via wscat
    let localId = command.localId || deviceInfo.localId;
    // log(`getServiceMember: localinfo`, localId);
    return {
        localId,
        address: deviceInfo ? deviceInfo.address : null,
        service: command.service,
        index: command.index,
        member: command.member,
        value: command.value
    };
}

function groupByPlugin(commands: DeviceCommand[]): { [pluginName: string]: DP.DeviceServiceMember[] } {
    let map: { [pluginName: string]: DP.DeviceServiceMember[] } = {};
    commands.forEach((command, index) => {
        (<any>command)._sequence = index; // preserve the original sequence number
        let pluginName = getPluginName(command);
        if (pluginName) {
            map[pluginName] = map[pluginName] || [];
            map[pluginName].push(getServiceMember(command));
        }
        // log(`groupByPlugin:`, pluginName, `for command`, command);
    });
    return map;
}

function loadPlugin(pluginName: string) {
    let p = plugin.instance(pluginName);
    if (!p)
        return;

    log(`${pluginName} loaded`);

    p.on('device info', (deviceInfo: DeviceInfo) => {
        deviceInfo.pluginName = pluginName;
        cache.setDeviceInfo(deviceInfo);
        log(`info < ${deviceInfo.pluginName}:${deviceInfo.localId}`);
        transport.sendRequest('device info', deviceInfo, (response, err) => {
            if (!response)
                return;
            let refreshedInfo: DP.DeviceInfo = JSON.parse(response);
            if (!response) {
                log(`loadPlugin: device info: no device information returned in packet:`, err);
                return;
            }
            cache.setDeviceInfo(refreshedInfo);
        });
    });

    p.on('event raised', (events: EventRaised[]) => {
        events.reduce((p, c) => {
            let d = cache.getDeviceByLocalId(c.localId);
            if (d.pluginName)
                c.pluginName = d.pluginName;
            return p.concat([c]);
        }, []);
        transport.send('event raised', events, err => { });
    });

    p.on('property changed', (properties: any[]) => {
        properties.reduce((p, c) => {
            let d = cache.getDeviceByLocalId(c.localId);
            if (d.pluginName)
                c.pluginName = d.pluginName;
            return p.concat([c]);
        }, []);
        transport.send('property changed', properties, err => { });
    });

    let basicSend = (event: string) => (data: any) => transport.send(event, data, err => {});

    p.on('discover complete', basicSend('discover complete'));
    p.on('log info', basicSend('event raised'));
    p.on('log error', basicSend('event raised'));
    p.on('plugin data', basicSend('plugin data'));
    p.on('plugin setting', basicSend('plugin setting'));

    plugins.set(pluginName, p);
}

function loadPlugins() {
    log('load plugins');
    if (settings.plugins && Array.isArray(settings.plugins)) {
        settings.plugins.forEach((name: any) => {
            if (typeof name === 'string')
                loadPlugin(name);
        });
    }
}

function sendDeviceMessage(message: DeviceMessage): DeviceMessageResponse {
    let device: any = cache.getDeviceByDeviceId(message.deviceId);
    let deviceId = message.deviceId;
    let data = message.message;
    
    if (device && device.pluginName)
        return plugin.instance(device).deviceMessage(deviceId, data, () => {
            // emit device message response through some manner
        });

    return { supported: false };
}

function setPluginData(settings: PluginData[]): PluginDataResponse {
    let results: PluginDataResponse = {
        supported: Array.apply(null, Array(settings.length))
    };
    results.supported = settings.reduce(function (p, c) {
        if (c && c.key && c.plugin && c.value) {
            cache.setPluginData(c.plugin, c.key, c.value);
            plugin.instance(c.plugin).emit('plugin data', c);
            return p.concat([true]);
        }
        return p.concat([false]);
    }, []);
    return results;
}

function setPluginSetting(settings: PluginSetting[]): PluginSettingResponse {
    let results: PluginSettingResponse = {
        supported: Array.apply(null, Array(settings.length)) // init all values to undefined
    };
    results.supported = settings.reduce(function (p, c) {
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
    let map = groupByPlugin(commands);
    let results: SetPropertiesResponse = {
        supported: Array.apply(null, Array(commands.length))
    };

    // log(`setProperties: mapped:`, map);
    Object.keys(map).forEach(pluginName => {
        // send commands to plugin
        let sectionResults = plugin.instance(pluginName).setProperties(map[pluginName]);
        // log(`plugin:`, pluginName, map[pluginName]);

        if (sectionResults) {
            // reorganize the results to the original sequence
            sectionResults.forEach(result => {
                let resultIndex = (<any>map)._sequence || 0;
                results.supported[resultIndex] = result;
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