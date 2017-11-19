import { EventEmitter } from 'events';
import * as DP from 'droplit-plugin';
import {
    DeviceMessageResponse,
    PluginMessageResponse,
    PluginSetting
} from './types/types';
const log = require('debug')('droplit:plugin');
const logv = require('debug')('droplit-v:plugin');
const pluginMap: { [name: string]: Controller } = {};
const localSettings = require('../localsettings.json');

export function instance(pluginName: string): Controller {
    try {
        const config = localSettings.diagnostics && localSettings.diagnostics.enabled ? { diagnostics: true } : null;
        return pluginMap[pluginName] = pluginMap[pluginName] || new Controller(pluginName, config);
    } catch (error) {
        // plugin failed to load
        log(`plugin: ${pluginName} failed to load!`);
        logv(error);
    }
    return undefined;
}

// Derived from router types
export interface InfoEvent {
    data: string;
    pluginName: string;
    timestamp: Date;
}

export interface ErrorEvent {
    data: string;
    pluginName: string;
    timestamp: Date;
}
/**
 * This class mostly just wraps the DroplitPlugin class to create a layer of abstraction
 * that allows us to later implement plugins as a separate process or in a sandbox
 * or accomodate for changes to the plugin design in the future
 */

export class Controller extends EventEmitter {
    private pluginInstance: DP.DroplitPlugin;
    private pluginName: string;

    constructor(pluginName: string, settings?: any) {
        super();
        this.pluginInstance = this.loadPlugin(pluginName, settings);
        this.pluginName = pluginName;
        this.initPlugin();
    }

    private loadPlugin(pluginName: string, settings?: any): DP.DroplitPlugin {
        const p = require(pluginName);
        return new p(settings);
    }

    private initPlugin() {
        this.pluginInstance.on('device info', this.deviceInfoHandler.bind(this));
        this.pluginInstance.on('device update', this.deviceUpdateHandler.bind(this));
        this.pluginInstance.on('discover complete', this.discoverCompleteHandler.bind(this));
        this.pluginInstance.on('property changed', this.propertiesChangedHandler.bind(this));
        this.pluginInstance.on('event raised', this.eventsHandler.bind(this));
        this.pluginInstance.on('log info', this.logInfoHandler.bind(this));
        this.pluginInstance.on('log error', this.logErrorHandler.bind(this));
        // this.pluginInstance.on('log info many', this.logInfoHandler.bind(this));
        // this.pluginInstance.on('log error many', this.logErrorHandler.bind(this));
    }

    // event handlers

    private deviceInfoHandler(deviceInfo: DP.DeviceInfo, callback?: (deviceInfo: DP.DeviceInfo) => {}) {
        this.emit('device info', this.deviceInfoFilter(deviceInfo), callback);
    }

    private deviceUpdateHandler(deviceInfo: DP.DeviceInfo) {
        this.emit('device update', this.deviceInfoFilter(deviceInfo));
    }

    private discoverCompleteHandler() {
        this.emit('discover complete');
    }

    private propertiesChangedHandler(properties: DP.DeviceServiceMember[]) {
        this.emit('property changed', properties.map(this.eventFilter));
    }

    private eventsHandler(events: DP.DeviceServiceMember[]) {
        this.emit('event raised', events.map(this.eventFilter));
    }

    private logInfoHandler(events: any[]) {
        this.emit('log info', events.map(this.infoFilter));
    }

    private logErrorHandler(events: any[]) {
        this.emit('log error', events.map(this.errorFilter));
    }

    // management

    public discover(): void {
        if (this.pluginInstance.discover)
            this.pluginInstance.discover();
    }

    public connect(localId: string): void {
        if (this.pluginInstance.connect)
            this.pluginInstance.connect(localId);
    }

    public disconnect(localId: string): void {
        if (this.pluginInstance.disconnect)
            this.pluginInstance.disconnect(localId);
    }

    public dropDevice(localId: string): void {
        if (this.pluginInstance.dropDevice)
            this.pluginInstance.dropDevice(localId);
    }

    // services

    public callMethods(methods: DP.DeviceServiceMember[]): boolean[] {
        return this.pluginInstance.callMethods(methods);
    }

    public getProperties(properties: DP.DeviceServiceMember[], callback: (values: DP.DeviceServiceMember[]) => void): boolean[] {
        return this.pluginInstance.getProperties(properties, callback);
    }

    public requestMethods(methods: DP.DeviceServiceMember[], callback: (values: DP.DeviceServiceMember[]) => void): boolean[] {
        return this.pluginInstance.requestMethods(methods, callback);
    }

    public setProperties(properties: DP.DeviceServiceMember[]): boolean[] {
        return this.pluginInstance.setProperties(properties);
    }

    public deviceMessage(localId: string, data: any, callback?: (response: any) => void): DeviceMessageResponse {
        return this.pluginInstance.deviceMessage(localId, data, callback);
    }

    public setSetting(setting: PluginSetting): void {
        this.pluginInstance.setSetting(setting);
    }

    private deviceInfoFilter(event: DP.DeviceInfo): DP.DeviceInfo {
        event.timestamp = event.timestamp ? event.timestamp as Date : new Date();
        return event;
    }
    private eventFilter(event: DP.DeviceServiceMember): DP.DeviceServiceMember {
        event.index = event.index ? event.index : '0';
        event.timestamp = event.timestamp ? event.timestamp as Date : new Date();
        return event;
    }

    // TODO: timestamps assigned here should be optionally assigned at event conception
    private errorFilter(data: any): ErrorEvent {
        log('errorFilter', data);
        // If we are passed an error object, parse it out as
        // JSON.stringify will not normalize the object appropriately.
        if (data instanceof Error)
            data = {
                name: data.name,
                message: data.message,
                stack: data.stack
            };
        return {
            data: JSON.stringify(data),
            pluginName: undefined,  // assigned in router
            timestamp: new Date(),
        };
    }

    private infoFilter(data: any): InfoEvent {
        log('infoFilter', data);
        return {
            data: JSON.stringify(data),
            pluginName: undefined,  // assigned in router
            timestamp: new Date(),
        };
    }

    public pluginMessage(message: any, callback?: (response: any) => void): PluginMessageResponse {
        return this.pluginInstance.pluginMessage(message, callback);
    }

    // local
    public getName() { return this.pluginName; }
}