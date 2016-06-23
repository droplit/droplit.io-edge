import Transport from '../transport';
import * as debug from 'debug';

let localSettings = require('../../localsettings.json');

let log = debug('droplit:load-test-connections');

let config: any = require('../../test-config.json');


function start() {
    getEdgeId((edgeId) => {
        let connections = 0;
        // TODO: Count maximum supported connections
        let totalConnections = config.loadTest.numConnections;
        let count = 0;
        for (let ii = 0; ii <= config.loadTest.numConnections; ii++) {
            console.log("Sent", ii);
            startConnection(edgeId, (connected) => {
                count++;
                console.log(connected);
                if (connected) {
                    connections++;
                }
                console.log(ii);
                if (count === config.loadTest.numConnections - 1) {
                    console.log("connections assigned", count);
                    console.log("Successful connections", connections);
                }
            });
        }
    });

}

function startConnection(edgeId: string, callback: (connected: boolean) => void) {
    let transport = new Transport();
    transport.start(config.transport, {
        "x-edge-id": edgeId,
        "x-ecosystem-id": localSettings.ecosystemId
    }, callback);

};
let _edgeId: string = undefined;

function getEdgeId(callback: (edgeId: string) => void) {
    if (_edgeId) {
        callback(_edgeId);
    } else {
        let mac = require('getmac');
        mac.getMac((err: Error, macAddress: string) => {
            if (err) throw err;
            _edgeId = macAddress;
            callback(_edgeId);
        });
    }
}
start();