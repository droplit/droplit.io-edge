import * as droplit from 'droplit-plugin';

export class ExamplePlugin extends droplit.DroplitPlugin {
    
    // virtual device states
    private devices: any = {
        '1': {
            'BinarySwitch.switch': 'off'
        },
        '2': {
            'BinarySwitch.switch': 'off'
        }
    };
    
    // virtual device tracking
    private deviceConnected: { [localId: string]: boolean } = {};
    
    /**
     * Example plugin will produce two devices when told to discover
     */
    
    public discover() {
        setImmediate(() => { // simulate async
            this.onDeviceInfo({
                localId: '1',
                address: 'device.1',
                deviceMeta: { name: 'first device'},
                location: 'main facility',
                name:  'device1',
                services: ['BinarySwitch'],
                promotedMembers: {
                    'switch': 'BinarySwitch.switch'
                }
            });
            this.onDeviceInfo({
                localId: '2',
                address: 'device.2',
                deviceMeta: { name: 'second device'},
                location: 'main facility',
                name:  'device2',
                services: ['BinarySwitch'],
                promotedMembers: {
                    'switch': 'BinarySwitch.switch'
                }
            });
            this.onDiscoverComplete();
        });
    }
    
    public connect(localId: string) {
        // track state changes on this device
        this.deviceConnected[localId] = true;
    }
    
    public disconnect(localId: string) {
        // stop tracking state changes on this device
        this.deviceConnected[localId] = false;
    }
    
    public dropDevice(localId: string) {
        this.disconnect(localId);
        
    }
    
    protected BinarySwitch_get_switch(localId: string, index: string, callback: (value: any) => void): boolean {
        if (index === undefined) {
            setImmediate(() => { // simulate async
                // send last set value
                callback(this.devices[localId]['BinarySwitch.switch']);
            });
            return true;
        }
        return false;
    }
    
    protected BinarySwitch_set_switch(localId: string, index: string, value: any): boolean {
        if (index === undefined) {
            setImmediate(() => { // simulate async
                // simulate setting device property
                this.devices[localId]['BinarySwitch.switch'] = value;
                // check if we're supposed to be tracking the device state
                if (this.deviceConnected[localId]) {
                    /**
                     * we have a connection to the device,
                     * so we would get a notification that the state changed
                     * indicate the property changed
                     */
                    this.onPropertiesChanged([{
                        localId: localId,
                        index: index,
                        member: 'switch',
                        service: 'BinarySwitch',
                        value: value
                    }]);
                } else {
                    /**
                     * send command to device, but state change doesn't 
                     * report back because the state is not being tracked 
                     */
                }
            });
            return true;
        }
        return false;
    }
}