import {EventEmitter} from 'events';
import * as DP from 'droplit-plugin';
import {DeviceMessageResponse} from './types/types';

let pluginMap: { [name: string]: Controller } = {};

export function instance(pluginName: string): Controller {
    try {
        return pluginMap[pluginName] = pluginMap[pluginName] || new Controller(pluginName);
    } catch (error) {
        // plugin failed to load
        console.log('error', error);
    }
    return undefined;
}

/**
 * This class mostly just wraps the DroplitPlugin class to create a layer of abstraction
 * that allows us to later implement plugins as a separate process or in a sandbox
 * or accomodate for changes to the plugin design in the future
 */

export class Controller extends EventEmitter {
    private pluginInstance: DP.DroplitPlugin = undefined;

    constructor(pluginName: string, settings?: any) {
        super();
        this.pluginInstance = this.loadPlugin(pluginName, settings);
        this.InitPlugin();
    }

    private loadPlugin(pluginName: string, settings?: any): DP.DroplitPlugin {
        let p = require(pluginName);
        return new p(settings);
    }

    private InitPlugin() {
        this.pluginInstance.on('device info', this.deviceInfoHandler.bind(this));
        this.pluginInstance.on('device update', this.deviceUpdateHandler.bind(this));
        this.pluginInstance.on('discover complete', this.discoverCompleteHandler.bind(this));
        this.pluginInstance.on('property changed', this.propertiesChangedHandler.bind(this));
        this.pluginInstance.on('event raised', this.eventsHandler.bind(this));
    }

    // event handlers

    private deviceInfoHandler(deviceInfo: DP.DeviceInfo) {
        this.emit('device info', deviceInfo);
    }

    private deviceUpdateHandler(deviceInfo: DP.DeviceInfo) {
        this.emit('device update', deviceInfo);
    }

    private discoverCompleteHandler() {
        // this.emit('discover complete');
    }

    private propertiesChangedHandler(properties: DP.DeviceServiceMember[]) {
        this.emit('property changed', properties);
    }

    private eventsHandler(events: DP.DeviceServiceMember[]) {
        this.emit('event raised', events);
    }

    // management

    public discover(): void {
        this.pluginInstance.discover();
    }

    public connect(localId: string): void {
        this.pluginInstance.connect(localId);
    }

    public disconnect(localId: string): void {
        this.pluginInstance.disconnect(localId);
    }

    public dropDevice(localId: string): void {
        this.pluginInstance.dropDevice(localId);
    }

    // services

    public callMethods(methods: DP.DeviceServiceMember[]): boolean[] {
        return this.pluginInstance.callMethods(methods);
    }

    public getProperties(properties: DP.DeviceServiceMember[], callback: (values: DP.DeviceServiceMember[]) => void): boolean[] {
        return this.pluginInstance.getProperties(properties, callback);
    }

    public setProperties(properties: DP.DeviceServiceMember[]): boolean[] {
        return this.pluginInstance.setProperties(properties);
    }

    public deviceMessage(localId: string, data: any, callback?: (response: any) => void): DeviceMessageResponse {
        return this.pluginInstance.deviceMessage(localId, data, callback);
    }
}