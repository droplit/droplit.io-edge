import * as DP from 'droplit-plugin';
import {DeviceInfo} from './types/types';

const deviceCache_local: { [localId: string]: DP.DeviceInfo } = {};
const deviceCache_global: { [deviceId: string]: DeviceInfo } = {};
const pluginCache_data: { [pluginKey: string]: string } = {};
const pluginCache_settings: { [pluginKey: string]: string } = {};

// ID Management
export function getDeviceByDeviceId(deviceId: string): DeviceInfo {
    return deviceCache_global[deviceId];
}

export function getDeviceByLocalId(localId: string): DP.DeviceInfo {
    return deviceCache_local[localId];
}

export function removeByLocalId(localId: string): void {
    // Remove from global
    Object.keys(deviceCache_global)
        .map(key => deviceCache_global[key])
        .filter(device => device.localId === localId)
        .forEach(device => delete deviceCache_global[device.deviceId]);
    // Remove from local
    delete deviceCache_local[localId];
}

export function setDeviceInfo(deviceInfo: DP.DeviceInfo | DeviceInfo): void {
    if (deviceInfo.hasOwnProperty('deviceId')) {
        let deviceId: string = (deviceInfo as any).deviceId;
        deviceCache_global[deviceId] = deviceInfo as DeviceInfo;
    }
    else
        deviceCache_local[deviceInfo.localId] = deviceInfo;
}

// Plugin Management
export function getPluginData(pluginName: string, key: string): string {
    let pluginKey = `${pluginName};${key}`;
    return pluginCache_data[pluginKey];
}

export function getPluginSetting(pluginName: string, key: string): string {
    let pluginKey = `${pluginName};${key}`;
    return pluginCache_settings[pluginKey];
}

export function setPluginData(pluginName: string, key: string, value: string): void {
    let pluginKey = `${pluginName};${key}`;
    pluginCache_data[pluginKey] = value;
}

export function setPluginSetting(pluginName: string, key: string, value: string): void {
    let pluginKey = `${pluginName};${key}`;
    pluginCache_settings[pluginKey] = value;
}