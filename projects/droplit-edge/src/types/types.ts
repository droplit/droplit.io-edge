import * as DP from 'droplit-plugin';

export interface DeviceInfo extends DP.DeviceInfo {
    deviceId: string;
    pluginName: string;
}

export interface DeviceCommand {
    deviceId: string;
    localId?: string;
    service: string;
    index: string;
    member: string;
    value?: any;
    commandIndex?: number;
}

export interface DeviceMessage {
    deviceId: string;
    message: any;
}

export interface EventRaised {
    pluginName: string;
    localId: string;
    service: string;
    index: string;
    member: string;
    value: any;
}

export type DiscoverComplete = EventRaised;
export type LogError = EventRaised;
export type LogInfo = EventRaised;
export type PropertyChanged = EventRaised;

export interface PluginData {
    plugin: string;
    key: string;
    value: any;
}
export type PluginSetting = PluginData;

export interface PluginMessage {
    plugin: string;
    message: any;
}

export interface GetPropertiesResponse { supported: boolean[]; values: DP.DeviceServiceMember[]; }
export interface SetPropertiesResponse { supported: boolean[]; }
export interface CallMethodResponse { supported: boolean[]; }
export interface RequestMethodResponse { supported: boolean[]; values: DP.DeviceServiceMember[]; }
export interface DeviceMessageResponse { supported: boolean; }
export interface PluginDataResponse { supported: boolean[]; }
export interface PluginMessageResponse { supported: boolean; }
export interface PluginSettingResponse { supported: boolean[]; }