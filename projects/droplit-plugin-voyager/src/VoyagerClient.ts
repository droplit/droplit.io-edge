import * as events from 'events';
import * as http from 'http';
import * as request from 'request';
import * as util from 'util';
import * as os from 'os';

let EventEmitter = events.EventEmitter;
let ips: any = [];
class VoyagerClient extends EventEmitter {

    address: string;
    identifier: any;
    product: any;

    // constructor (init: any) {
    //     super();

    //     this.address = init.location.host;
    //     this.identifier = init.identifier;
    //     this.product = {
    //         friendlyName: init.info.device.friendlyName,
    //         manufacturer: init.info.device.manufacturer,
    //         modelDescription: init.info.device.modelDescription,
    //         modelName: init.info.device.modelName,
    //         modelNumber: init.info.device.modelNumber
    //     };

    //     let subIds = {};

    //     let notificationPort = 3500;
    //     let localAddress = getLocalAddress()[0];
    //     let server = http.createServer(handleNotification.bind(this));

    //     server.on('error', e => {
    //         if (e.code === 'EADDRINUSE') {
    //             startServer(++notificationPort);
    //         } else {
    //             console.log(`listen error: ${e.toString()}`);
    //         }
    //     });
    //     server.on('listening', () => {
    //         subscribe.bind(this)('/upnp/event/basicevent1');
    //     });

    //     startServer(notificationPort);

    //     function getLocalAddress() {
    //         if (ips.length > 0) {
    //             return ips;
    //         }
    //         let interfaces = os.NetworkInterfaceInfo();
    //         Object.keys(interfaces).forEach(name => {
    //             if (/(loopback|vmware\internal)/gi.test(name)) {
    //                 return;
    //             }
    //             interfaces[name].forEach(info => {
    //                 if (!info.internal && info.family === 'IPv4') {
    //                     ips.push(info.address);
    //                 }
    //             });
    //         });
    //         return ips;
    //     }

    //     function handleNotification (res, res) {
    //         res.statusCode = 200;

    //         let buffer: any = [];

    //     }
    // }
}