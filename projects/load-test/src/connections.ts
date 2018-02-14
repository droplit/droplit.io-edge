import * as router from '../../droplit-edge';
import * as debug from 'debug';
import * as fs from 'fs';
import * as path from 'path';

const DROPLIT_ROOT = '.droplit.io';
if (fs.existsSync(path.join('projects', 'droplit-edge', 'localsettings.json')) == true) {
    var localSettings = require('../localsettings.json');
} else {
    var localSettings = require(path.join(droplitDir(), 'localsettings.json'));  
}

const log = debug('droplit:load-test-connections');
const config: any = require('../test-config.json');
const connections: any[] = [];

function start() {
    getEdgeId(edgeId => {
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
                connections
                    .filter(connection => connection.id === transportId)
                    .forEach(connection => connection.connected = connected);
            });
        }
        // });
        setTimeout(() => {
            for (const connection of connections)
                console.log(connection);
        }, 100000);
    });
}

function droplitDir() {
    var homeFolder;
    if (process.env.HOME !== undefined) {
        homeFolder = path.join(process.env.HOME, DROPLIT_ROOT);
    }
    if (process.env.HOMEDRIVE && process.env.HOMEPATH) {
        homeFolder = path.join(process.env.HOMEDRIVE, process.env.HOMEPATH, DROPLIT_ROOT);
    }
    if (!homeFolder) {
        fs.mkdirSync(homeFolder, 502); // 0766
    }
    return homeFolder;
}

function startConnection(edgeId: string, iteration: number, callback: (connected: boolean, transportId: number) => void) {
    const transport = new router.Transport();

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
        connections
            .filter(connection => connection.id === transportId)
            .forEach(connection => connection.retries = currentAttempt);
    });

    // console.log("beforeStart");

    config.transport.transportId = iteration;
    transport.start(config.transport, {
        'x-edge-id': edgeId,
        'x-ecosystem-id': localSettings.ecosystemId
    }, connected => {
        callback(connected, iteration);
    });

}

const _edgeId = 'kduhdkhdkjhd';

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
