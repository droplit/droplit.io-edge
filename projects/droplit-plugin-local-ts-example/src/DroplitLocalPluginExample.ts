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
    public getMotd(localId: string, value: any) {
        return true;
    }

    // Set: Set MOTD value
    public setMotd(localId: any, value: any) {
        this.motd = value;
        return true;
    }

    // Method: Annnounce MOTD across the hub
    public announceMotd(localId: any) {
        console.log(this.motd);
        return true;
    }
}