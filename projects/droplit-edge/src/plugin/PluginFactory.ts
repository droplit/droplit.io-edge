import {EventEmitter} from 'events';
import * as DP from 'droplit-plugin';

export class PluginFactory extends EventEmitter {
    
    constructor(pluginName: string, settings: any) {
        super();
        
    }
    
    public discover(): void {
        
    }
    
    public connect(identifier: string): void {
        
    }
    
    public disconnect(identifier: string): void {
        
    }
    
    public dropDevice(idenrifier: string): void {
        
    }
    
    public callMethods(methods: DP.DeviceServiceMember[]): boolean[] {
        return undefined;
    }
    
    public getProperties(properties: DP.DeviceServiceMember[], callback: (values: DP.DeviceServiceMember[]) => void): boolean[] {
        return undefined;
    }
    
    public setProperties(properties: DP.DeviceServiceMember[]): boolean[] {
        return undefined;
    }
}