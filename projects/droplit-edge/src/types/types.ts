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
}

export interface PropertyChanged {
    localId: string;
    service: string;
    index: string;
    member: string;
    value: any;
    pluginName: string;
}

export interface EventRaised {
    pluginName: string;
    localId: string;
    service: string;
    index: string;
    member: string;
    value: any;
};

export interface LogInfo {
    pluginName: string;
    localId: string;
    service: string;
    index: string;
    member: string;
    value: any;
}
export interface LogError {
    pluginName: string;
    localId: string;
    service: string;
    index: string;
    member: string;
    value: any;
}
export interface DiscoverComplete {
    pluginName: string;
    localId: string;
    service: string;
    index: string;
    member: string;
    value: any;
}
export interface PluginData {
    pluginName: string;
    localId: string;
    service: string;
    index: string;
    member: string;
    value: any;
}
