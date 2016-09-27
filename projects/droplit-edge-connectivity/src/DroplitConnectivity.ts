import * as droplit from 'droplit-plugin';

console.log('droplit connectivity');

export class DroplitConnectivity extends droplit.DroplitLocalPlugin {

    services: any;

    constructor() {
        super();
        // console.log('example construct');
        this.services = {
            Connectivity: {
                get_status: this.getStatus,
                set_status: this.setStatus,
                connect: this.connect,
            }
        };
    }

    public getStatus(localId: string, value: any) {
        console.log('passed value:', value);
        return true;
    }
    public setStatus(localId: any, value: any, index: any) {
        let changedProps: droplit.DeviceServiceMember = {
            localId: '.',
            service: 'Connectivity',
            member: 'status',
            index: '1',
            // address: '.',
            // error: undefined,
            value: 'setStatus event :D'
        };
        this.onPropertiesChanged([changedProps]);
        this.onEvents([changedProps]);
        this.log(['this is an event']);
        this.logError(['this is an error']);
        return true;
    }
    public connect() {
        console.log('Connectivity: [connecting]');
        return true;
    }
}