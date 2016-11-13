import { EventEmitter } from 'events';
const debug = require('debug')('droplit:DroplitPlugin');

/**
 * DeviceServiceMember - Address information for device and service member
 * @typedef {Object} DeviceServiceMember
 * @param {string} localId - device unique identifier (unique within this plugin in this environment)
 * @param {string} service - Service class name
 * @param {string} index - Service class instance
 * @param {string} member - Service class member
 * @param {any} value - Service member value
 * @export
 * @interface DeviceServiceMember
 */
export interface DeviceServiceMember {
    localId: string;
    address?: any;
    service: string;
    index: string;
    member: string;
    value?: any;
    error?: Error;
}

/**
 * DeviceInfo - Everything about a device
 * @typedef {Object} DeviceInfo
 * @param {string} localId - device unique identifier (unique within this plugin in this environment)
 * @param {any} address - device address on this network
 * @param {string} product - manufacturer, assigned name and type
 * @param {string} name - user assigned friendly name (seeds the label)
 * @param {string} location - user assigned location
 * @param {any} deviceMeta - any custom device information
 * @param {string[]} services - list of services supported on this device
 * @param {any} promotedMembers - list of properties and methods that are promoted formatted as 'serviceName.memberName[:alias]'
 * @export
 * @interface DeviceInfo
 */
export interface DeviceInfo {
    localId: string;
    address?: any;
    product?: any;
    localName?: string;
    localData?: any;
    services?: string[];
    promotedMembers?: { [name: string]: string };
    pluginName?: string;
}
export abstract class DroplitLocalPlugin extends EventEmitter {

    /**
     * callMethod - Call a service method
     *
     * @param {DeviceServiceMember} method - boolean indicating if method is supported
     */
    public callMethod(method: DeviceServiceMember): boolean {
        /**
         * The edge server will never call the signular version of this method,
         * it is just here as an abstraction layer and can be disregarded
         * if overriding the plural version.
         */
        this.log(`call ${this.getServiceSelector(method)} with ${method.value}`);

        // call does not support callbacks, so pass undefined (callbacks are used by request overload)
        const params = [method.localId, method.value, undefined, method.index];
        const methodImplementation = this.getServiceMember(method.service, method.member);

        if (methodImplementation) {
            const isSupported = methodImplementation.apply(this, params);
            return this.getMethodStatus(isSupported);
        }

        // method not implemented
        return false;
    }

    /**
     * callMethods - Call multiple service methods
     *
     * @param {DeviceServiceMember[]} methods - array of methods to call
     * @returns {boolean[]} array of booleans indicating if method is supported
     */
    public callMethods(methods: DeviceServiceMember[]): boolean[] {
        return methods.map(method => this.callMethod(method));
    }

    /**
     * getProperties - Gets multiple service property values
     * Override this method if you need to handle multiple properties in a single callback
     *
     * @param {DeviceServiceMember[]} properties - properties to get
     * @param {(values: DeviceServiceMember[]) => void} callback - callback for results
     * @returns {boolean[]} array of booleans indicating if each property is supported
     */
    public getProperties(properties: DeviceServiceMember[], callback: (values: DeviceServiceMember[]) => void): boolean[] {
        // could use `async` library, but didn't want external dependency
        const values: DeviceServiceMember[] = Array.apply(null, Array(properties.length)); // init all values to undefined
        const expiryTimeout = setTimeout(() => {
            if (callback) {
                callback(values);
                callback = undefined;
            }
        }, 10000);
        return properties.map((property, index) => {
            const cb = (value: any) => {
                values[index] = value;
                if (values.every(value => value !== undefined)) {
                    if (callback) {
                        clearTimeout(expiryTimeout);
                        callback(values);
                        callback = undefined;
                    }
                }
            };
            return this.getProperty(property, cb);
        });
    }

    /**
     * getProperty - Get a service property value
     *
     * @param {DeviceServiceMember} property - property to get
     * @param {(value: any) => void} callback - callback for result
     * @returns {boolean} boolean indicating if property is supported
     */
    public getProperty(property: DeviceServiceMember, callback: (value: any) => void): boolean {
        /**
         * The edge server will never call the signular version of this method,
         * it is just here as an abstraction layer and can be disregarded
         * if overriding the plural version.
         */
        this.log(`get ${this.getServiceSelector(property)}`);

        const params = [property.localId, callback, property.index];
        const methodImplementation = this.getServiceMember(property.service, `get_${property.member}`);

        if (methodImplementation) {
            const isSupported = methodImplementation.apply(this, params);
            return this.getMethodStatus(isSupported);
        }

        // method not implemented
        return false;
    }

    /**
     * requestMethod - Call a service method and get response value
     *
     * @param {DeviceServiceMember} method - method to call
     * @param {(value: any) => void} callback - callback for result
     * @returns {boolean} boolean indicating if property is supported
     */
    public requestMethod(method: DeviceServiceMember, callback: (value: any) => void): boolean {
        this.log(`request ${this.getServiceSelector(method)} with ${method.value}`);

        const params = [method.localId, method.value, callback, method.index];
        const methodImplementation = this.getServiceMember(method.service, method.member);

        if (methodImplementation) {
            const isSupported = methodImplementation.apply(this, params);
            return this.getMethodStatus(isSupported);
        }

        // method not implemented
        return false;
    }

    /**
     * requestMethods - Calls multiple service methods and gets response values
     *
     * @param {DeviceServiceMember[]} methods - methods to call
     * @param {(values: DeviceServiceMember[]) => void} callback - callback for results
     * @returns {boolean[]} array of booleans indicating if each property is supported
     */
    public requestMethods(methods: DeviceServiceMember[], callback: (values: DeviceServiceMember[]) => void): boolean[] {
        // could use `async` library, but didn't want external dependency
        const values: DeviceServiceMember[] = Array.apply(null, Array(methods.length)); // init all values to undefined
        const expiryTimeout = setTimeout(() => {
            if (callback) {
                callback(values);
                callback = undefined;
            }
        }, 10000);
        return methods.map((method, index) => {
            const cb = (value: any) => {
                values[index] = value;
                if (values.every(value => value !== undefined)) {
                    if (callback) {
                        clearTimeout(expiryTimeout);
                        callback(values);
                        callback = undefined;
                    }
                }
            };
            return this.requestMethod(method, cb);
        });
    }

    /**
     * setProperties - Sets multiple service property values
     *
     * @param {DeviceServiceMember[]} properties - properties to set
     * @returns {boolean[]} adday of booleans indicating if each property is supported
     */
    public setProperties(properties: DeviceServiceMember[]): boolean[] {
        return properties.map(property => this.setProperty(property));
    }

    /**
     * setProperty - Set a service propery value
     *
     * @param {DeviceServiceMember} property - property to set
     * @returns {boolean} - boolean indicating if property is supported
     */
    public setProperty(property: DeviceServiceMember): boolean {
        /**
         * The edge server will never call the signular version of this method,
         * it is just here as an abstraction layer and can be disregarded
         * if overriding the plural version.
         */
        this.log(`set ${this.getServiceSelector(property)} to ${property.value}`);
        const params = [property.localId, property.value, property.index];
        const methodImplementation = this.getServiceMember(property.service, `set_${property.member}`);
        if (methodImplementation) {
            const isSupported = methodImplementation.apply(this, params);
            return this.getMethodStatus(isSupported);
        } else {
            // method not implemented
            return false;
        }
    }

    /**
     * log - Write to the log
     *
     * @protected
     * @param {...any[]} args (description)
     */
    protected log(...args: any[]): void {
        // TODO: this is a cheap hack
        this.emit('log info', args.map(arg => { return arg; }));
    }

    /**
     * logError - Write error information to thr log
     *
     * @protected
     * @param {...any[]} args (description)
     */
    protected logError(...args: any[]): void {
        this.emit('log error', args);
    }

    /**
     * Settings
     */

    protected writeSetting(key: string, value: any) {
        this.emit('plugin setting', key, value);
    }

    protected readSetting(key: string, callback: (value: any) => void) {

    }

    protected listSettings(callback: (keys: string[]) => {}) {

    }

    /**
     * Events
     */

    /**
     * onPropertiesChanged - Raises an event indicating that device properties have changed state
     *
     * @protected
     * @param {DeviceServiceMember[]} properties (description)
     */
    protected onPropertiesChanged(properties: DeviceServiceMember[]) {
        this.emit('property changed', properties);
    }

    /**
     * onEvents - Raises an event indicating that devices have raised events
     *
     * @protected
     * @param {DeviceServiceMember[]} events (description)
     */
    protected onEvents(events: DeviceServiceMember[]) {
        this.emit('event raised', events);
    }

    /**
     * Helper methods
     * Internal use only to support service member routing
     */

    protected getServiceSelector(member: DeviceServiceMember): string {
        return `${member.localId}/${member.service}${member.index ? `[${member.index}]` : ''}.${member.member}`;
    }

    protected getServiceMember(service: string, member: string): () => void {
        return this.getFunction(this, `services.${service}.${member}`);
    }

    protected getFunction(obj: any, path: string): () => void {
        return path.split('.').reduce((o, x) =>
            (typeof o === undefined || o === null) ? o : o.hasOwnProperty(x) ? o[x] : null
            , obj);
    }
    // reference: http://stackoverflow.com/questions/23808928/javascript-elegant-way-to-check-nested-object-properties-for-null-undefined

    protected getMethodStatus(isSupported: boolean) {
        if (isSupported === null || isSupported === undefined) {
            return true;
        } else {
            return isSupported;
        }
    }
}

export abstract class DroplitPlugin extends DroplitLocalPlugin {

    /**
     * discover all devices
     *
     * @abstract
     */
    public abstract discover(): void

    /**
     * Start tracking the specified device
     *
     * @param {string} localId - device unique identifier
     * @abstract
     */
    public connect(localId: string): boolean {
        return false;
    }

    /**
     * Stop tracking the specified device
     *
     * @param {string} localId - device unique identifier
     * @abstract
     */
    public disconnect(localId: string): boolean {
        return false;
    }

    /**
     * Device message from upstream
     *
     * @param {string} localId - device unique identifier
     * @param {*} data - message body
     * @param {(response: any) => void} [callback] Response callback (undefined if no response is expected)
     */
    public deviceMessage(localId: string, data: any, callback?: (response: any) => void): { supported: boolean } {
        return { supported: true };
    }

    /**
     * dropDevice - clear device information from memory, disconnect
     *
     * @abstract
     * @param {string} idenrifier (description)
     */
    public abstract dropDevice(localId: string): boolean

    /**
     * Events
     */

    /**
     * onDeviceUpdate - Raises an event indicating that the device details have changed or a new device has been discovered
     *
     * @protected
     * @param {DeviceInfo} deviceInfo (description)
     */
    protected onDeviceInfo(deviceInfo: DeviceInfo, callback?: (deviceInfo: DeviceInfo) => {}) {
        this.emit('device info', deviceInfo, callback);
    }

    /**
     * onDiscoverComplete - Raises an event indicting that the device discovery cycle has completed
     *
     * @protected
     */
    protected onDiscoverComplete() {
        this.emit('discover complete');
    }

    /**
     * onPropertiesChanged - Raises an event indicating that device properties have changed state
     *
     * @protected
     * @param {DeviceServiceMember[]} properties (description)
     */
    protected onPropertiesChanged(properties: DeviceServiceMember[]) {
        this.emit('property changed', properties);
    }

    /**
     * onEvents - Raises an event indicating that devices have raised events
     *
     * @protected
     * @param {DeviceServiceMember[]} events (description)
     */
    protected onEvents(events: DeviceServiceMember[]) {
        this.emit('event raised', events);
    }

    /**
     * Helper methods
     * Internal use only to support service member routing
     */

    protected getServiceSelector(member: DeviceServiceMember): string {
        return `${member.localId}/${member.service}${member.index ? `[${member.index}]` : ''}.${member.member}`;
    }

    protected getServiceMember(service: string, member: string): () => void {
        return this.getFunction(this, `services.${service}.${member}`);
    }

    protected getFunction(obj: any, path: string): () => void {
        return path.split('.').reduce((o, x) =>
            (typeof o === undefined || o === null) ? o : o.hasOwnProperty(x) ? o[x] : null
            , obj);
    }
    // reference: http://stackoverflow.com/questions/23808928/javascript-elegant-way-to-check-nested-object-properties-for-null-undefined

    protected getMethodStatus(isSupported: boolean) {
        if (isSupported === null || isSupported === undefined) {
            return true;
        } else {
            return isSupported;
        }
    }

    /**
     * Service Method Handler Function
     *
     * this.services.SERVICE_NAME.METHOD_NAME()
     *
     */
}
