import * as droplit from 'droplit-plugin';

export class DroplitLocalPluginExample extends droplit.DroplitLocalPlugin {

    services: any;
    motd: any = 'My first local Droplit plugin';

    constructor() {
        super();
        this.services = {
            Host: {
                get_motd: this.getMotd,
                set_motd: this.setMotd,
                announce: this.announceMotd
            }
        };
    }

    // Get: Get MOTD value
    public getMotd(localId: string, cb: (value: any) => any) {
        cb(this.motd);
        return true;
    }

    // Set: Set MOTD value
    public setMotd(localId: any, value: any) {
        this.motd = value;
        const propChanges: droplit.DeviceServiceMember = {
            localId,
            member: 'service',
            service: 'Host',
            index: undefined,
            value: this.motd
        };
        this.onPropertiesChanged([propChanges]);
        return true;
    }

    // Method: Annnounce MOTD across the hub
    public announceMotd(localId: any) {
        console.log(this.motd);
        return true;
    }
}