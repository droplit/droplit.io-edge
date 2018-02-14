import * as http from 'http';
import * as debug from 'debug';
import * as fs from 'fs';
import * as path from 'path';
export const router = require('router')();
const bodyParser = require('body-parser');
const log = debug('droplit:network');
const DROPLIT_ROOT = '.droplit.io';
if (fs.existsSync(path.join('projects', 'droplit-edge', 'localsettings.json')) == true) {
    var localSettings = require('../localsettings.json');
} else {
    var localSettings = require(path.join(droplitDir(), 'localsettings.json'));  
}
let PORT: number;
let server: http.Server;

export interface IwInfoObject {
    mac: string;
    ssid: string;
    mode: string;
    channel: string;
    signal: string;
    quality: string;
    encryption: string;
    uci: string;
}

// For UCI options, see:
// https://wiki.openwrt.org/doc/uci/wireless#common_interface_options
// https://wiki.openwrt.org/doc/uci/wireless#wpa_modes

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

export interface IwObject {
    encryption: boolean;
    mac: string;
    ssid: string;
    signal: string;
}

export const Network = (edgeId: string) => {
    PORT = 81;
    if (localSettings.config && localSettings.config.provisioningServicePort) {
        log(`Starting Edge server on ${localSettings.config.provisioningServicePort}`);
        PORT = localSettings.config.provisioningServicePort;
    }

    server = http.createServer((request, response) => {
        router(request, response, require('finalhandler')(request, response));
    });
    server.listen(PORT, () => {
        log('Edge Server Listening on Port:', PORT);
    });

    router.use(bodyParser.json());
    router.route('/droplit-edge')
        .get(getEdgeId);
    router.route('/droplit-edge/config/wifi')
        .get(getWifi)
        .put(setWifi);
    router.route('/droplit-edge/config/full-wifi')
        .get(getFullWifi);

    function getEdgeId(req: any, res: http.ServerResponse) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        log(`GET /droplit-edge ${res.statusCode}`);
        return res.end(JSON.stringify({
            edgeId
        }));
    }

    function getWifi(req: http.ServerRequest, res: http.ServerResponse) {
        res.setHeader('Content-Type', 'application/json');
        iwScan().then(items => {
            res.statusCode = 200;
            log(`GET /droplit-edge/config/wifi ${res.statusCode}`);
            return res.end(JSON.stringify({ items }));
        }).catch(error => {
            res.statusCode = 500;
            log(`GET /droplit-edge/config/wifi ${res.statusCode}`);
            return res.end(error);
        });
    }

    function setWifi(req: any, res: http.ServerResponse) {
        res.setHeader('Content-Type', 'application/json');
        log(`request body: ${JSON.stringify((<any>req).body, null, 2)}`);

        if (!req.body || !req.body.ssid) {
            res.statusCode = 400;
            log(`PUT /droplit-edge/config/wifi ${res.statusCode}`);
            return res.end(JSON.stringify({ message: 'malformed request' }));
        }

        // Open network
        if (!req.body.key) {
            res.statusCode = 200;
            log(`PUT /droplit-edge/config/wifi ${res.statusCode}`);
            res.end();
            return clientMode(req.body.ssid);
        }

        // Network encryption type supplied, try and use it.
        if (req.body.encryption) {
            res.statusCode = 200;
            log(`PUT /droplit-edge/config/wifi ${res.statusCode}`);
            res.end();
            return clientMode(req.body.ssid, req.body.key, req.body.encryption);
        }

        // Only ssid and key supplied
        // Switch to wifi client, scan, and connect.
        res.statusCode = 200;
        log(`PUT /droplit-edge/config/wifi ${res.statusCode}`);
        res.end();
        log(`Entering client mode...`);
        clientMode('temp').then(() => {
            log(`Attempting to scan while in client mode...`);
            let uci: any = null;
            iwinfoScan()
                .then(networks => {
                    networks = networks.filter(network => network.ssid === req.body.ssid);
                    if (networks.length >= 1) {
                        uci = networks[0].uci;
                    } else {
                        return Promise.reject(`Could not find ${req.body.ssid}.`);
                    }
                })
                .then(network => {
                    if (!uci) return Promise.reject(`Could not determine encryption type for ${req.body.ssid}.`);
                    log(`Attempting to connect to ${req.body.ssid} with an encryption type of ${uci}...`);
                    clientMode(req.body.ssid, req.body.key, uci);
                })
                .catch(error => log(error));
        });
    }

    function getFullWifi(req: http.ServerRequest, res: http.ServerResponse) {
        res.setHeader('Content-Type', 'application/json');
        iwinfoScan().then(items => {
            res.statusCode = 200;
            log(`GET /droplit-edge/config/wifi ${res.statusCode}`);
            return res.end(JSON.stringify({ items }));
        }).catch(error => {
            res.statusCode = 500;
            log(`GET /droplit-edge/config/wifi ${res.statusCode}`);
            return res.end(error);
        });
    }

    function iwinfoScan(): Promise<IwInfoObject[]> {
        return new Promise((resolve, reject) => {
            try {
                const network = require('/usr/bin/scanWifi.js');
                network.fullScanWifi((items: IwInfoObject[]) => {
                    log(items);
                    resolve(items);
                });
            }
            catch (error) {
                console.log(error);
                reject(error);
            }
        });
    }

    function iwScan(): Promise<IwObject[]> {
        return new Promise((resolve, reject) => {
            try {
                const network = require('/usr/bin/scanWifi.js');
                network.simpleScanWifi((items: IwObject[]) => {
                    log(items);
                    resolve(items);
                });
            }
            catch (error) {
                console.log(error);
                reject(error);
            }
        });
    }

    // Connect WiFi interfaces
    function clientMode(SSID: string, password?: string, authSuite?: string) {
        return new Promise(res => {
            const childProcess = require('child_process');
            log(`Connecting to ${SSID}${authSuite ? ` with Auth Suite ${authSuite}` : ''}`);

            const command = childProcess.spawn('clientMode', authSuite ? [SSID, authSuite, password] : [SSID]);
            command.stdout.on('data', (data: any) => {
                log(`stdout: ${data}`);
            });

            command.stderr.on('data', (data: any) => {
                log(`stderr: ${data}`);
            });

            command.on('close', (code: any) => {
                log(`child process exited with code ${code}`);
                res(true);
            });
        });
    }

    return {
        clientMode
    };
};
