import * as router from '../../droplit-edge';
import * as debug from 'debug';

let localSettings = require('../localsettings.json');

let log = debug('droplit:load-test-connections');

let config: any = require('../test-config.json');

let eventualSuccess: boolean[] = new Array(config.loadTest.numConnections);

function start() {
    getEdgeId((edgeId) => {
        let connections = 0;
        // TODO: Count maximum supported connections
        let totalConnections = config.loadTest.numConnections;
        let count = 0;
        let undefinedCount = 0;
        let retryCount = -1;
        let failCount = 0;
        for (let ii = 0; ii <= config.loadTest.numConnections - 1; ii++) {
            startConnection(edgeId, ii , (connected) => {
                count++;
                if (connected === true) {
                connections++;
                console.log(ii);
            } else if (connected === undefined) {
                        undefinedCount++;
                        retryCount++;
                    } else if (connected === false) {
                        failCount++;
                        retryCount++;
                    }
                if (count === config.loadTest.numConnections - 1) {
                    console.log("connections assigned", count);
                    console.log("Successful connections", connections);
                    console.log("undefined: ", undefinedCount);
                    console.log("fail count: ", failCount);
                    console.log(eventualSuccess[7], "hello");

                }
            });
        }
    });

}

function startConnection(edgeId: string, iteration: number , callback: (connected: boolean) => void) {
    let transport = new router.Transport();
    transport.on("connected", () => {
        console.log("ishqya");
        eventualSuccess[iteration];
    });

    transport.start(config.transport, {
        "x-edge-id": edgeId,
        "x-ecosystem-id": localSettings.ecosystemId
    }, callback);

}; 
let _edgeId: string = "kduhdkhdkjhd";

function getEdgeId(callback: (edgeId: string) => void) {
    // if (_edgeId) {
    //     callback(_edgeId);
    // } else {
    //     let mac = require('getmac');
    //     mac.getMac((err: Error, macAddress: string) => {
    //         if (err) throw err;
    //         _edgeId = macAddress;
    //         callback(_edgeId);
    //     });
    // }
callback(_edgeId);
    
}
start();