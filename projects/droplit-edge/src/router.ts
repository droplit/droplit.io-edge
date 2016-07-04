import * as cache from './cache';
import Transport from './transport';
import * as plugin from './plugin';
import * as DP from 'droplit-plugin';
import * as debug from 'debug';
import * as async from 'async';
import {DeviceInfo} from './types/DeviceInfo';
let log = debug('droplit:router');

export interface DeviceCommand {
    deviceId: string;
    localId?: string;
    service: string;
    index: string;
    member: string;
    value?: any;
}

// Amount of time (ms) to wait before turning on auto discover
const AutoDiscoverDelay = 2 * 60 * 1000;
// Amount of time (ms) between discovery attempts
const AutoDiscoverCadence = 60000;

let settings = require('../settings.json');
let localSettings = require('../localsettings.json');
// overwrite settings with local settings
Object.keys(localSettings).forEach((key) => {
    settings[key] = localSettings[key];
});

let autodiscoverTimer: number;
let transport = new Transport();

declare var Map: any; // Work-around typescript not knowing Map when it exists for the JS runtime
let plugins = new Map();

if (settings.debug.generateHeapDump) {
    const heapdump = require('heapdump');
    const heapInterval = 30 * 60 * 1000;

    writeSnapshot.bind(this)();
    setInterval(writeSnapshot.bind(this), heapInterval);

    function writeSnapshot() {
        heapdump.writeSnapshot(`droplit-${Date.now()}.heapsnapshot`, (err: any, filename: string) => {
            if (err) {
                console.log('error writing heap snapshot:', err);
                return;
            }
            console.log(`wrote heap snaphot: ${filename}`);
        });
    }
}

transport.once('connected', () => {
    loadPlugins();
    discoverAll();
    if (settings.router.autodiscover)
        setTimeout(startAutodiscover.bind(this), AutoDiscoverDelay);
});

transport.on('disconnected', () => { });

transport.on('#discover', (data: any) => { });

transport.on('#drop', (data: any) => {
    if (data)
        dropDevice(data);
});

transport.on('#property set', (data: any, cb: (response: any) => void) => {
    let results: boolean[] = [];

    // console.log(`property set:`, data);

    // Wrap single property in an array
    if (!Array.isArray(data) && typeof data === 'object')
        data = [data];

    if (data)
        results = setProperties(data);

    if (cb)
        cb(results);
});

transport.on('#property get', (data: any, cb: (response: any) => void) => {

    // Wrap single property in an array
    if (!Array.isArray(data) && typeof data === 'object')
        data = [data];

    if (data && cb)
        getProperties(data).then(results => {
            cb(results);
        });

});

transport.on('#method call', (data: any, cb: (response: any) => void) => {
    // Wrap single method in an array
    if (!Array.isArray(data) && typeof data === 'object')
        data = [data];

    if (data)
        callMethods(data);

    if (cb)
        cb(true);
});

// transport.on('#plugin message', (data: any, cb: (response: any) => void) => {

// });

// transport.on('#plugin setting', (data: any, cb: (response: any) => void) => {

// });


export function callMethods(commands: DeviceCommand[]): void {
    let map = groupByPlugin(commands);
    let results: boolean[] = Array.apply(null, Array(commands.length)); // init all values to undefined
    Object.keys(map).forEach(pluginName => {
        // send commands to plugin
        plugin.instance(pluginName).callMethods(map[pluginName]);
    });
}

/**
 * Discovers devices for a single plugin. If not specified, runs discovery for all plugins.
 * 
 * @export
 * @param {string} [pluginName] Plugin to run discovery
 */
export function discover(pluginName?: string) {
    if (pluginName)
        return discoverOne(pluginName);
    discoverAll();
}

export function dropDevice(commands: DeviceCommand[]) {
    let map = groupByPlugin(commands);
    let results: boolean[] = Array.apply(null, Array(commands.length)); // init all values to undefined
    Object.keys(map).forEach(pluginName => {
        map[pluginName].forEach(device => {
            // send commands to plugin
            plugin.instance(pluginName).dropDevice(device.localId);
        });
    });
}

export function getProperties(commands: DeviceCommand[]): Promise<{ supported: boolean[], values: DP.DeviceServiceMember[] }> {
    let GET_PROPERTY_TIMEOUT = 3000;
    let map: { [pluginName: string]: DP.DeviceServiceMember[] } = groupByPlugin(commands);
    let results: { supported: boolean[], values: DP.DeviceServiceMember[] } = {
        supported: Array.apply(null, Array(commands.length)), // init all values to undefined
        values: Array.apply(null, Array(commands.length)) // init all values to undefined
    };

    // assuming openFiles is an array of file names
    return new Promise<{ supported: boolean[], values: DP.DeviceServiceMember[] }>((resolve, reject) => {

        // If the device information does not return in the alloted time, return what we have with an error
        let err: Error = {
            message: `The request could not be fufilled or fully fufilled.
                Command information:` + JSON.stringify(map) +
                `Current results:` + JSON.stringify(results),
            name: `Device Property Get`,
        };
        let timer = setTimeout(() => sendResponse(err), GET_PROPERTY_TIMEOUT);

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
                }; cb();
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

            resolve(results);
        }
    });
}

export function setProperties(commands: DeviceCommand[]): boolean[] {
    let map = groupByPlugin(commands);
    let results: boolean[] = Array.apply(null, Array(commands.length)); // init all values to undefined

    // log(`setProperties: mapped:`, map);
    Object.keys(map).forEach(pluginName => {
        // send commands to plugin
        let sectionResults = plugin.instance(pluginName).setProperties(map[pluginName]);
        // log(`plugin:`, pluginName, map[pluginName]);

        if (sectionResults) {
            // reorganize the results to the original sequence
            sectionResults.forEach((result, index) => {
                let resultIndex = (<any>map)._sequence || 0;
                results[resultIndex] = result;
            });
        }
    });
    return results;
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

function getServiceMember(command: DeviceCommand): DP.DeviceServiceMember {
    // log(`getServiceMember: command`, command);
    let deviceInfo = cache.getDeviceByDeviceId(command.deviceId);
    // log(`getServiceMember: deviceInfo`, deviceInfo);
    // HACK: Allows easier testing via wscat
    let localId = command.localId || deviceInfo.localId;
    // log(`getServiceMember: localinfo`, localId);
    return {
        localId: localId,
        address: deviceInfo ? deviceInfo.address : null,
        service: command.service,
        index: command.index,
        member: command.member,
        value: command.value
    };
}

function getPluginName(command: DeviceCommand) {
    // HACK: Allows easier testing via wscat
    let local = cache.getDeviceByLocalId(command.localId);
    if (local) {
        return local.pluginName;
    }

    let device = cache.getDeviceByDeviceId(command.deviceId);
    if (device) {
        return device.pluginName;
    }

    return null;
}

function loadPlugins() {
    log('load plugins');
    loadPlugin('droplit-plugin-lifx');
    // loadPlugin('droplit-plugin-philips-hue');
    // loadPlugin('droplit-plugin-sonos');
    // loadPlugin('droplit-plugin-wemo');
    // loadPlugin('droplit-plugin-voyager');
    loadPlugin('droplit-plugin-ts-example');



}

function loadPlugin(pluginName: string) {
    let p = plugin.instance(pluginName);
    if (!p)
        return;

    p.on('device info', (deviceInfo: DP.DeviceInfo) => {
        deviceInfo.pluginName = pluginName;
        cache.setDeviceInfo(deviceInfo);
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

    // DP.DeviceServiceMember[]
    p.on('property changed', (properties: any[]) => {
        properties.reduce((p, c, i, a) => {
            let d: any = cache.getDeviceByLocalId(c.localId);
            if (d.pluginName) {
                c.pluginName = d.pluginName;
            }
            return p.concat([c]);
        }, []);
        // console.log(`property changed: `, properties);
        transport.send('property changed', properties, err => { });
    });
    plugins.set(pluginName, p);
}

function startAutodiscover() {
    // Already auto-discovering
    if (autodiscoverTimer)
        return;

    // First auto should be immediate
    discoverAll.bind(this)();
    autodiscoverTimer = setInterval(discoverAll.bind(this), AutoDiscoverCadence);
}

let _edgeId: string = undefined;

function getEdgeId(callback: (edgeId: string) => void) {
    if (_edgeId) {
        callback(_edgeId);
    } else {
        let mac = require('getmac');
        mac.getMac((err: Error, macAddress: string) => {
            if (err) throw err;
            _edgeId = macAddress;
            callback(_edgeId);
        });
    }
}

getEdgeId((edgeId) => {
    transport.start(settings.transport, {
        "x-edge-id": edgeId,
        "x-ecosystem-id": settings.ecosystemId // requires ecosystemId to be set in localsettings.json
    });
});