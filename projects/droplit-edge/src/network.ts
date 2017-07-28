import * as http from 'http';
import * as debug from 'debug';
export const router = require('router')();
const bodyParser = require('body-parser');
const log = debug('droplit:network');
const localSettings = require('../localsettings.json');
let PORT: number;
let server: http.Server;

// Initialize with 1 to avoid falsy results
export enum AuthSuite {
    psk = 1,
    psk2,
    'psk-mixed',
    aes,
    ccmp,
    tkip,
    wpa,
    wpa2,
    'wpa-mixed'
}

export interface WifiObject {
    SSID: string;
    CIPHER: string;
    AUTH_SUITE: string;
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
        .get((req: any, res: http.ServerResponse) => {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            const result = {
                edgeId
            };
            log(`GET /droplit-edge ${res.statusCode}`);
            res.end(JSON.stringify(result));
        });
    router.route('/droplit-edge/config/wifi')
        .get((req: http.ServerRequest, res: http.ServerResponse) => {
            res.setHeader('Content-Type', 'application/json');
            scanWifi().then(items => {
                res.statusCode = 200;
                res.end(JSON.stringify({ items }));
                log(`GET /droplit-edge/config/wifi ${res.statusCode}`);
            }).catch(error => {
                res.statusCode = 400;
                res.end(error);
                log(`GET /droplit-edge/config/wifi ${res.statusCode}`);
            });
        })
        .put((req: any, res: http.ServerResponse) => {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            log(`request body: ${JSON.stringify((<any>req).body, null, 2)}`);
            if (req.body && req.body.SSID) {
                scanWifi()
                    .then(networks => {
                        networks = networks.filter(network => network.SSID === req.body.SSID);
                        if (networks.length === 1) {
                            return networks[0];
                        } else {
                            const message = `Could not connect to ${req.body.SSID}. Network ${req.body.SSID} not found!`;
                            res.statusCode = 404;
                            res.end(JSON.stringify({ message }));
                            log(`PUT /droplit-edge/config/wifi ${res.statusCode}`);
                            return Promise.reject(message);
                        }
                    })
                    .then(network => {
                        log(`PUT /droplit-edge/config/wifi ${res.statusCode}`);
                        res.end();
                        const authSuite = req.body.AUTH_SUITE || network.AUTH_SUITE;
                        if (authSuite) {
                            connectWiFi(network.SSID, req.body.PASS, <any>AuthSuite[authSuite.toLowerCase()]);
                        } else {
                            connectWiFi(network.SSID);
                        }
                    })
                    .catch(error => log(error));
            } else {
                res.statusCode = 400;
                res.end(JSON.stringify({ message: 'malformed request' }));
                log(`PUT /droplit-edge/config/wifi ${res.statusCode}`);
            }
        });

    function parseWifi(wifi_string: string) {
        log(`unparsed_string: ${wifi_string}`);
        const items = wifi_string
            .trim() // remove trailing whitespaces and \n at end of string
            .split('\n') // break out each output into its own line
            .map(line => line.trim().slice(1, line.length - 1).split('][')) // return an array of things inside [...]
            .reduce((wifis: WifiObject[], line: string[]) => {
                wifis.push({
                    SSID: line[0],
                    CIPHER: line[1],
                    AUTH_SUITE: line[2]
                });
                return wifis;
            }, []);
        return items;
    }

    function scanWifi(): Promise<WifiObject[]> {
        return new Promise((resolve, reject) => {
            const childProcess = require('child_process');
            childProcess.exec('scanWifi', (error: any, stdout: any, stderr: any) => {
                if (error) {
                    console.log(error);
                    reject(error);
                }
                else {
                    const items = parseWifi(stdout);
                    resolve(items);
                }
            });
        });
    }
    // OpenWRT Scan and Connect WiFi interfaces
    function connectWiFi(SSID: string, password?: string, authSuite?: AuthSuite) {
        return new Promise(res => {
            const childProcess = require('child_process');
            log(`Connecting to ${SSID}${authSuite ? ` with Auth Suite ${AuthSuite[<any>authSuite]}` : ''}`);
            childProcess.exec(`connectWiFi ${SSID}${authSuite ? ` ${AuthSuite[<any>authSuite]}` : ''}${password ? ` ${password}` : ''}`, (error: any, stdout: any, stderr: any) => {
                if (error || stderr) {
                    console.log('Error:', error || stderr);
                    res(false);
                } else
                    res(true);
            });
        });
    }

    return {
        parseWifi,
        connectWiFi,
        scanWifi
    };
};
