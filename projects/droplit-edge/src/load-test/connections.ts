import Transport from '../transport';
import * as debug from 'debug';

let log = debug('droplit:load-test-connections');

let config: any = require('../../test-config.json');



function start() {
    // TODO: Count maximum supported connections
    let totalConnections = config.loadTest.numConnections;
  let count = 0;
 for (let ii = 0; ii < config.loadTest.numConnections; ii++) {
    startConnection((connected) => {
         console.log(connected);
         if ( connected) {
        count++;
         console.log(count);
     }
    });
 }
   console.log(count);
}


function startConnection(callback: (connected: boolean) => void ) {
    let transport = new Transport();
    getEdgeId((edgeId) => {
        let localSettings = require('../../localsettings.json');
        transport.start(config.transport, {
            "x-edge-id": edgeId,
            "x-ecosystem-id": localSettings.ecosystemId
        }, callback);
    
        });
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