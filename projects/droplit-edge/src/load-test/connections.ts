import Transport from '../transport';
import * as debug from 'debug';

let log = debug('droplit:load-test-connections');

let config = require('./test-config.json');



function start() {
    // TODO: Count maximum supported connections
    let totalConnections = config.loadTest.numConnections;
    

}

function startConnection() {
    let transport = new Transport();
    getEdgeId((edgeId) => {
        let localSettings = require('../../localsettings.json');
        transport.start(config.transport, {
            "x-edge-id": edgeId,
            "x-ecosystem-id": localSettings.ecosystemId
        }, (connected) => {
            // TODO: test if connection succeeded

        });
    });
}


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

