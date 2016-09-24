import * as droplit from 'droplit-plugin';

console.log('droplit connectivity');

export class DroplitConnectivity extends droplit.DroplitPlugin {

    services: any;

    constructor() {
        super();
        // console.log('example construct');
        this.services = {
            Connectivity: {
                get_status: this.getStatus,
            }
        };
    }

    // virtual device tracking
    private deviceConnected: { [localId: string]: boolean } = {};

    /**
     * Example plugin will produce two devices when told to discover
     */

    public discover() {
        setImmediate(() => { // simulate async
            this.onDeviceInfo({
                localId: '.',
                services: ['Connectivity'],
                promotedMembers: {
                    'status': 'Connectivity.status'
                }
            });
            this.onDiscoverComplete();
        });
    }

    public connect(localId: string): boolean {
        // track state changes on this device
        this.deviceConnected[localId] = true;
        return true;
    }

    public disconnect(localId: string): boolean {
        // stop tracking state changes on this device
        this.deviceConnected[localId] = false;
        return true;
    }

    public dropDevice(localId: string): boolean {
        this.disconnect(localId);
        return true;
    }

    public getStatus(localId: string, callback: (result: any) => void) {
        callback('online');
    }
}