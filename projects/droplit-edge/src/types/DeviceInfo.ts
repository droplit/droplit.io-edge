import * as DP from 'droplit-plugin';

export interface DeviceInfo extends DP.DeviceInfo {
    deviceId: string;
    pluginName: string;
}