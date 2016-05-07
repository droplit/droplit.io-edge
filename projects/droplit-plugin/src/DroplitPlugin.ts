import {EventEmitter} from 'events';

/**
 * DeviceServiceMember - Address information for device and service member
 * @typedef {Object} DeviceServiceMember
 * @param {string} identifier - device unique identifier (unique within this plugin in this environment)
 * @param {string} service - Service class name
 * @param {string} index - Service class instance
 * @param {string} member - Service class member
 * @param {any} value - Service member value
 * @export
 * @interface DeviceServiceMember
 */
export interface DeviceServiceMember {
    identifier: string;
    service: string;
    index: string;
    member: string;
    value?: any;
}


/**
 * DeviceInfo - Everything about a device
 * @typedef {Object} DeviceInfo
 * @param {string} identifier - device unique identifier (unique within this plugin in this environment)
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
    identifier: string;
    address?: any;
    product?: any;
    name?: string;
    location?: string;
    deviceMeta?: any;
    services?: string[];
    promotedMembers?: { [name: string]: string };
}

export abstract class DroplitPlugin extends EventEmitter {
    
    
    /**
     * discover - discover all devices
     * 
     * @abstract
     */
    public abstract discover(): void
    
    /**
     * connect - Start tracking the specified device
     * 
     * @param {string} identifier - device unique identifier
     * @abstract
     */
    public abstract connect(identifier: string): void
    
    /**
     * disconnect - Stop tracking the specified device
     * 
     * @param {string} identifier - device unique identifier
     * @abstract
     */
    public abstract disconnect(identifier: string): void
    
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
        // if (method.value !== undefined && method.value !== null && !Array.isArray(method.value)) throw new Error('value must be an array'); 
        this.log(`call ${this.getServiceSelector(method)} with ${method.value}`);
        let params = method.value || [];
        params.unshift(method.identifier);
        let methodImplementation = this.getServiceMember(method.service, method.member);
        if (methodImplementation) {
            let isSupported = methodImplementation.apply(this, params);
            return this.getMethodStatus(isSupported);
        } else {
            // method not implemented
            return false;
        }
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
        let params = [property.identifier, callback];
        let methodImplementation = this.getServiceMember(property.service, `get_${property.member}`);
        if (methodImplementation) {
            let isSupported = methodImplementation.apply(this, params);
            return this.getMethodStatus(isSupported);
        } else {
            // method not implemented
            return false;
        }
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
        let params = [property.identifier, property.value];
        let methodImplementation = this.getServiceMember(property.service, `get_${property.member}`);
        if (methodImplementation) {
            let isSupported = methodImplementation.apply(this, params);
            return this.getMethodStatus(isSupported);
        } else {
            // method not implemented
            return false;
        }
    }
    
    /**
     * getProperties - Gets multiple service property values
     * 
     * @param {DeviceServiceMember[]} properties - properties to get
     * @param {(values: DeviceServiceMember[]) => void} callback - callback for results
     * @returns {boolean[]} array of booleans indicating if each property is supported
     */
    public getProperties(properties: DeviceServiceMember[], callback: (values: DeviceServiceMember[]) => void): boolean[] {
        // could use `async` library, but didn't want external dependency
        let values: DeviceServiceMember[] = Array.apply(null, Array(properties.length)); // init all values to undefined
        return properties.map((property, index) => {
            let cb = (value: any) => {
                values[index] = value;
                if (values.every(value => value !== undefined)) callback(values);
            };
            return this.getProperty(property, cb);
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
     * dropDevice - clear device information from memory, disconnect
     * 
     * @abstract
     * @param {string} idenrifier (description)
     */
    public abstract dropDevice(idenrifier: string): void
    
    /**
     * log - Write to the log
     * 
     * @protected
     * @param {...any[]} args (description)
     */
    protected log(... args: any[]): void {
        this.emit('log info', args);
    }
    
    /**
     * logError - Write error information to thr log
     * 
     * @protected
     * @param {...any[]} args (description)
     */
    protected logError(... args: any[]): void {
        this.emit('log error', args);
    }
    
    /**
     * Events
     */
    
    /**
     * onDeviceUpdate - Raises an event indicating that the device details have changed or a new device has been discovered
     * 
     * @protected
     * @param {DeviceInfo} deviceInfo (description)
     */
    protected onDeviceInfo(deviceInfo: DeviceInfo) {
        this.emit('device info', deviceInfo);
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
        return `${member.identifier}/${member.service}${member.index ? `[${member.index}]` : ''}.${member.member}`;
    }
    
    protected getServiceMember(service: string, member: string): () => void {
        let methodFunc = this.getFuntion(this, `services.${service}.${member}`);
        return methodFunc;
    }
    
    protected getFuntion(obj: any, path: string): () => void {
        return path.split('.').reduce(function(o, x) {
            return (typeof o === undefined || o === null) ? o : o[x];
        }, obj);
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