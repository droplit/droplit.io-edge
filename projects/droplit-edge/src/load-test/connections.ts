import Transport from '../transport';
import * as debug from 'debug';
import * as chalk from 'chalk';

let localSettings = require('../localsettings.json');

let log = debug('droplit:load-test-connections');

let config: any = require('../../test-config.json');

let initialSuccess: boolean[] = new Array(config.loadTest.numConnections);
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
        let eventualSuccess: any = 0;

        let delay: number; // ms
        console.log("ETA: " +  ((totalConnections * delay) / 800) / 100 + " min");
        let timeoutID: any;
        for (let ii = 0; ii <= totalConnections - 1; ii++) {
            delay = Math.floor((Math.random() * 700) + 100); // randomizing delay time
                    console.log(`${chalk.cyan(delay.toString())}`); // printing delay time
             setTimeout(() => {
                startConnection(edgeId, ii , (connected) => {
                    console.log(edgeId);
                    count++;
                    if (connected) {
                        connections++; 
                    } else if (connected === undefined) {
                        undefinedCount++;
                        retryCount++;
                    } else if (connected === false) {
                        failCount++;
                        retryCount++;
                    }
                    console.log(ii);
                    if (count === totalConnections - 1) {
                        console.log("connections assigned", count);
                        console.log("undefined: ", undefinedCount);
                        console.log("fail count: ", failCount);
                        console.log("Successful connections", connections);
                        console.log(eventualSuccess[7], "thee");
                    }
                });
            }, delay * ii);

        }
    });

}

function startConnection(edgeId: string, iteration: number, callback: (connected: boolean) => void) {
    let transport = new Transport();

    transport.on("connected", () => {
        console.log("dnkjdkjd");
        eventualSuccess[iteration] = true;
    });   

    transport.start(config.transport, {
        "x-edge-id": edgeId,
        "x-ecosystem-id": localSettings.ecosystemId
    }, callback);
};

let _edgeId: string = undefined;

function getEdgeId(callback: (edgeId: string) => void) {
    // if (_edgeId) {
    //     callback(_edgeId);
    // } 
    
    // else {
        
       // let mac = require('getmac');
        // mac.getMac((err: Error, macAddress: string) => {
        //     if (err) throw err;
        //     _edgeId = macAddress;
        //     callback(_edgeId);
       // });
   // }
   callback(_edgeId);
}
start();
