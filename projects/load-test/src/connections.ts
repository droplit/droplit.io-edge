import * as router from '../../droplit-edge';
import * as debug from 'debug';

let localSettings = require('../localsettings.json');

let log = debug('droplit:load-test-connections');

let config: any = require('../test-config.json');

let connections: Array<any> = [];

function start() {
    getEdgeId((edgeId) => {
        // let connections = 0;
        // TODO: Count maximum supported connections
        // let totalConnections = config.loadTest.numConnections;
        // let count = 0;
        // let undefinedCount = 0;
        // let retryCount = -1;
        // let failCount = 0;

        // let delay: number ; // ms
        // delay = Math.floor((Math.random() * 1000) + 100); // randomizing delay time
        // console.log(`${chalk.cyan(delay.toString())}`); // printing delay time
        // setTimeout(() => {
        for (let ii = 0; ii < config.loadTest.numConnections; ii++) {
            startConnection(edgeId, ii, (connected: boolean, transportId: number) => {
                log(`${transportId} finished!`);
                for (let index = 0; index < connections.length; index++) {
                    if (connections[index].id === transportId) {
                        connections[index].connected = connected;
                    }
                }
            });
        }
    // });
        setTimeout(() => {
            for (let index = 0; index < connections.length; index++) {
                console.log(connections[index]);
            }
        }, 100000);
    });
}

function startConnection(edgeId: string, iteration: number, callback: (connected: boolean, transportId: number) => void) {
    let transport = new router.Transport();

    // for (let kk = 0; kk < eventualSuccess.length; kk++) {
    //     if (eventualSuccess[kk].id === iteration) {
    //         eventualSuccess[kk].connected = true;
    //     }
    // }

    connections.push({
        id: iteration,
        connected: false,
        retries: 0
    });

    transport.on(`#retry:${iteration}`, (currentAttempt: any, transportId: number) => {
        console.log('on retry', iteration, currentAttempt);

        for (let index = 0; index < connections.length; index++) {
            // console.log(connections[index], index, connections.length);
            if (connections[index].id === transportId) {
                connections[index].retries = currentAttempt;
            }
        }
    });

    // console.log("beforeStart");

    config.transport.transportId = iteration;
    transport.start(config.transport, {
        'x-edge-id': edgeId,
        'x-ecosystem-id': localSettings.ecosystemId
    }, (connected) => {
        callback(connected, iteration);
    });

};
let _edgeId = 'kduhdkhdkjhd';

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
