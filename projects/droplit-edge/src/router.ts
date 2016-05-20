import * as cache from './cache';
import Transport from './transport';
import * as plugin from './plugin';
import * as DP from 'droplit-plugin';
import * as debug from 'debug';
import {DeviceInfo} from './types/DeviceInfo';

let log = debug('droplit:router');

export interface DeviceCommand {
    deviceId: string;
    service: string;
    index: string;
    member: string;
    value?: any;
}

let settings = require('../settings.json');

let transport = new Transport();

transport.on('connected', () => {
    loadPlugins();
});

transport.on('disconnected', () => { });

transport.on('#discover', (data: any) => { });

transport.on('#property set', (data: any, cb: (response: any) => void) => {
    let results: boolean[] = [];
    if (data)
        setProperties(data);
        
    if (cb)
        cb(results);
});

transport.on('#property get', (data: any, cb: (response: any) => void) => { });

transport.on('#method call', (data: any, cb: (response: any) => void) => { });

// transport.on('#plugin message', (data: any, cb: (response: any) => void) => {
    
// });

// transport.on('#plugin setting', (data: any, cb: (response: any) => void) => {
    
// });


/**
 * Discovers devices for a single plugin. If not specified, runs discovery for all plugins.
 * 
 * @export
 * @param {string} [pluginName] Plugin to run discovery
 */
export function discover(pluginName?: string) { }

export function setProperties(commands: DeviceCommand[]): boolean[] {
    let map = groupByPlugin(commands);
    let results: boolean[] = Array.apply(null, Array(commands.length)); // init all values to undefined
    Object.keys(map).forEach((pluginName) => {
        // send commands to plugin
        let sectionResults = plugin.instance(pluginName).setProperties(map[pluginName]);
        // reorganize the results to the original sequence
        sectionResults.forEach((result, index) => {
            let resultIndex = (<any>map[pluginName][index])._sequence;
            results[resultIndex] = result;
        });
    });
    return results;
}

export function getProperties(commands: DeviceCommand[]): boolean[] {
    return undefined;
}

function groupByPlugin(commands: DeviceCommand[]): {[pluginName: string]: DP.DeviceServiceMember[]} {
    let map: {[pluginName: string]: DP.DeviceServiceMember[]} = {};
    commands.forEach((command, index) => {
        (<any>command)._sequence = index; // preserve the original sequence number
        let pluginName = getPluginName(command);
        if (pluginName) {
            map[pluginName] = map[pluginName] || [];
            map[pluginName].push(getServiceMember(command));
        }
    });
    return map;
}

function getServiceMember(command: DeviceCommand): DP.DeviceServiceMember {
    let deviceInfo = cache.getDeviceByDeviceId(command.deviceId);
    return {
        localId: deviceInfo.localId,
        service: command.member,
        index: command.index,
        member: command.member,
        value: command.value
    };
}

function getPluginName(command: DeviceCommand) {
    let device = cache.getDeviceByDeviceId(command.deviceId);
    if (device) 
        return device.pluginName;
    return null;
}

function loadPlugins() {
    log('load plugins');
    let p = plugin.instance('droplit-plugin-js-example');
    p.on('device info', (deviceInfo: DP.DeviceInfo) => {
        cache.setDeviceInfo(deviceInfo);
    });
    // plugin.instance('droplit-plugin-ts-example');
}

transport.start(settings.transport);