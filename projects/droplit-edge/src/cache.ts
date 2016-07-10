import * as DP from 'droplit-plugin';
import {DeviceInfo} from './types/types';

let deviceCache_local: { [localId: string]: DP.DeviceInfo } = {};
let deviceCache_global: { [deviceId: string]: DeviceInfo } = {};
let pluginCache_data: { [pluginKey: string]: string } = {};
let pluginCache_settings: { [pluginKey: string]: string } = {};

export function setDeviceInfo(deviceInfo: DP.DeviceInfo | DeviceInfo): void {
    if ((<Object>deviceInfo).hasOwnProperty('deviceId')) {
        let deviceId: string = (<any>deviceInfo).deviceId;
        deviceCache_global[deviceId] = <DeviceInfo>deviceInfo;
        // let localCachedDevice = deviceCache_local[deviceInfo.localId];
        console.log(`[G] cached ${deviceId} with ${deviceInfo.localId} >>`, deviceInfo);
        // if (localCachedDevice) {
            // console.log(`[GL] cached ${deviceInfo.localId} >>`, deviceInfo);
            // deviceCache_local[deviceInfo.localId] = <DeviceInfo>deviceInfo;
        // };

    } else {
        // console.log(`[L] cached ${deviceInfo.localId} >>`, deviceInfo);
        deviceCache_local[deviceInfo.localId] = deviceInfo;
    }
}

export function getDeviceByLocalId(localId: string): DP.DeviceInfo {
    // console.log('local object:', deviceCache_local);
    // if (deviceCache_local[localId] !== undefined)
    //     console.log(`[BL] >> (${localId}) >> ${deviceCache_local[localId].localId}`);
    // else
    //     console.log(`[BL] >> (${localId}) >> XX`);
    return deviceCache_local[localId];
}

export function getDeviceByDeviceId(deviceId: string): DeviceInfo {
    // if (deviceCache_global[deviceId] !== undefined)
    //     console.log(`[BG] >> (${deviceId}) >> ${deviceCache_global[deviceId].localId}`);
    // else
    //     console.log(`[BG] >> (${deviceId}) >> XX`);
    return deviceCache_global[deviceId];
}

export function setPluginData(pluginName: string, key: string, value: string): void {
    let pluginKey = `${pluginName};${key}`;
    pluginCache_data[pluginKey] = value;
}

export function setPluginSettings(pluginName: string, key: string, value: string): void {
    let pluginKey = `${pluginName};${key}`;
    pluginCache_settings[pluginKey] = value;
}

export function getPluginData(pluginName: string, key: string): string {
    let pluginKey = `${pluginName};${key}`;
    return pluginCache_data[pluginKey];
}

export function getPluginSetting(pluginName: string, key: string): string {
    let pluginKey = `${pluginName};${key}`;
    return pluginCache_settings[pluginKey];
}
