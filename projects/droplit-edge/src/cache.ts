import * as DP from 'droplit-plugin';
import {DeviceInfo} from './types/DeviceInfo';

let deviceCache_local: {[localId: string]: DP.DeviceInfo} = {};
let deviceCache_global: {[deviceId: string]: DeviceInfo} = {};

export function setDeviceInfo(deviceInfo: DP.DeviceInfo | DeviceInfo) {
    if ((<Object>deviceInfo).hasOwnProperty('deviceId')) {
        let deviceId: string = (<any>deviceInfo).deviceId;
        deviceCache_global[deviceId] = <DeviceInfo>deviceInfo;
    } else {
        deviceCache_local[deviceInfo.localId] = deviceInfo;
    }
}

export function getDeviceByLocalId(localId: string): DP.DeviceInfo {
    return deviceCache_local[localId];
}

export function getDeviceByDeviceId(deviceId: string): DeviceInfo {
    return deviceCache_global[deviceId];
}
