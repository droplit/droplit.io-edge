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
            }
        };
    }


    public getStatus(localId: string, callback: (result: any) => void) {
        callback('online');
    }
}