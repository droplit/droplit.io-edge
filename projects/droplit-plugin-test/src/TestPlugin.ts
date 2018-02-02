import * as droplit from 'droplit-plugin';

export class TestPlugin extends droplit.DroplitPlugin {

    // ensure connectivity ability is live
    private connectActive = false;

    // virtual device states
    private readonly devices: any = {};

    // virtual device tracking
    private readonly deviceConnected: { [localId: string]: boolean } = {};

    protected services: any;

    constructor() {
        super();

        this.services = {
            BinarySwitch: {
                get_switch: this.getSwitch,
                set_switch: this.setSwitch,
                switchOff: this.switchOff,
                switchOn: this.switchOn
            },
            Connectivity: {
                connect: this.connect,
                disconnect: this.disconnect,
                get_status: this.getStatus
            },
            Test: {
                doStuff: this.doStuff
            }
        };
    }

    /**
     * Example plugin will produce two devices when told to discover
     */
    public discover() {
        setImmediate(() => { // simulate async
            if (!this.devices[1]) {
                this.devices[1] = { 'BinarySwitch.switch': 'off' };
                this.onDeviceInfo({
                    localId: '1',
                    address: 'device.1',
                    deviceMeta: {
                        customName: 'first device',
                        location: 'main facility'
                    },
                    services: ['BinarySwitch', 'Connectivity', 'Test'],
                    promotedMembers: {
                        switch: 'BinarySwitch.switch'
                    }
                });
            }

            if (!this.devices[2]) {
                this.devices[2] = { 'BinarySwitch.switch': 'off' };
                this.onDeviceInfo({
                    localId: '2',
                    address: 'device.2',
                    deviceMeta: {
                        customName: 'second device',
                        location: 'main facility'
                    },
                    services: ['BinarySwitch', 'Connectivity', 'Test'],
                    promotedMembers: {
                        switch: 'BinarySwitch.switch'
                    }
                });
            }

            this.onDiscoverComplete();
        });
    }

    public dropDevice(localId: string): boolean {
        this.disconnect(localId);
        delete this.devices[localId];
        return true;
    }

    // BinarySwitch Implementation
    protected getSwitch(localId: string, callback: (value: any) => void): boolean {
        // device does not exist
        if (!this.devices[localId]) {
            callback(undefined);
            return true;
        }

        setImmediate(() => { // simulate async
            // send last set value
            callback(this.devices[localId]['BinarySwitch.switch']);
        });
        return true;
    }

    protected setSwitch(localId: string, value: any): boolean {
        // device does not exist
        if (!this.devices[localId])
            return true;

        // check if values are valid
        if (value !== 'on' && value !== 'off')
            return true;

        // simulate setting device property
        this.devices[localId]['BinarySwitch.switch'] = value;

        // check if we're supposed to be tracking the device state
        if (!this.connectActive || this.deviceConnected[localId]) {
            // send state change notification
            setImmediate(() => // simulate async
                this.onPropertiesChanged([{
                    localId,
                    index: '0',
                    member: 'switch',
                    service: 'BinarySwitch',
                    value
                }])
            );
        }
        return true;
    }

    protected switchOff(localId: string): boolean {
        return this.setSwitch(localId, 'off');
    }

    protected switchOn(localId: string): boolean {
        return this.setSwitch(localId, 'on');
    }

    protected doStuff(localId: string): void {
        setImmediate(() =>
            this.onEvents([{
                localId,
                index: '0',
                member: 'didStuff',
                service: 'Test'
            }])
        );
    }

    // Connectivity Implementation
    public connect(localId: string): boolean {
        this.connectActive = true;
        // track state changes on this device
        this.deviceConnected[localId] = true;
        return true;
    }

    public disconnect(localId: string): boolean {
        // stop tracking state changes on this device
        this.deviceConnected[localId] = false;
        return true;
    }

    public getStatus(localId: string, callback: (value: any) => void): boolean {
        callback(this.devices[localId]['Connectivity.status']);
        return true;
    }
}