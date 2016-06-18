import * as droplit from 'droplit-plugin';
const Discoverer = require('./Discoverer');
// const Clients = require('./VoyagerClient');
import * as request from 'request';

const upnpSearch = 'venstar:thermostat:ecp';

export class VoyagerPlugin extends droplit.DroplitPlugin {

    devices: any;
    discoverer: any;

    constructor() {
        super();

        this.devices = {};
        this.discoverer = new Discoverer();

        this.discoverer.on('discovered', onDiscovered.bind(this));
        // this.discoverer.on('ipchange', onDiscoverIPChange.bind(this));

        function onDiscovered(device: any) {
            console.log(device.address);
            if (device.identifier in this.devices) {
                return;
            }
            // let client = Clients.VoyagerClient.create(device);
            // client.on('prop-change', (data: any) => {
            //     this.onPropertiesChanged([data]);
            // });
            // this.devices.device.identifier = client;
            
        }

        // function onDiscoverIPChange(data: any) {
        //     let identifier = data.identifier;
        //     let address = data.ip.host;
        //     let client = this.devices.get(identifier);
        //     if (!client) {
        //         return;
        //     }
        //     client.address = address;
        //     this.onDeviceInfo({ address, identifier });
        // }
    }

    public discover() {
        this.discoverer.discover();
    }

    dropDevice(localId: string): boolean {
        return false;
    }

    query(localId: string) {
        request.get({
            url: localId + '/query/info'
        },
        (error: any, response: any, body: any) => {
            if (response.statusCode === 200) {
                console.log(response, body);
                return body;
            }
        });
    }
    sensor(localId: string) {
        request.get({
            url: localId + '/query/sensors'
        },
        (error: any, response: any, body: any) => {
            if (response.statusCode === 200) {
                console.log(response, body);
            }
        });
    }
    alert(localId: string) {
        request.get({
            url: localId + '/query/alerts'
        }, (error: any, response: any, body: any) => {
            if (response.statusCode === 200) {
                console.log(response, body);
            }
        });
    }
    // control(localId: string, setting: string, value: number) {
    //     request.post({
    //         url: localId + '/control'

    //     })
    // }

}

module.exports = VoyagerPlugin;