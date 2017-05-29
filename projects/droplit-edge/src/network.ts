import * as http from 'http';
import * as debug from 'debug';
const router = require('router')();
const bodyParser = require('body-parser');
const log = debug('droplit:network');
const localSettings = require('../localsettings.json');
let PORT: number;
let server: http.Server;
let SSID: string;
interface WifiObject {
    SSID: string;
    CIPHER: string;
    AUTH_SUITE: string;
}
module.exports = (edgeId: string) => {
    SSID = edgeId.replace(new RegExp('[:-]+', 'g'), '');
    PORT = 81;
    if (localSettings.config && localSettings.config.portOverride) {
        log(`Starting Edge server on ${localSettings.config.portOverride}`);
        PORT = localSettings.config.portOverride;
    }
    log(edgeId);
    log(SSID);
    SSID = `hub_${SSID.slice(SSID.length - 4, SSID.length)}`;
    server = http.createServer((request, response) => {
        router(request, response, require('finalhandler')(request, response));
    });
    log(SSID);
    // createWap(SSID);
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
            log(`REQ:${JSON.stringify(req.headers, null, 2)} RECEIVED`);
            res.end(JSON.stringify(result));
        });
    router.route('/droplit-edge/config/wifi')
        .get((req: http.ServerRequest, res: http.ServerResponse) => {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            // const items = parseWifi('[Stanley Homes Inc][TKIP][PSK]\n[Stanley Homes Inc-guest][OPEN][]\n[Foxconn OEM][OPEN][]\n[droplit][CCMP][PSK]\n[CableWiFi][OPEN][] ');
            scanWifi().then(items => res.end(JSON.stringify({ items }))).catch(error => log(error));
        })
        .put((req: any, res: http.ServerResponse) => {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            let command = '';
            // const childProcess = require('child_process');
            log(`request body: ${JSON.stringify((<any>req).body, null, 2)}`);
            if (req.body && req.body.SSID) {
                scanWifi().then((theWifis: WifiObject[]) => theWifis.forEach(wifi => {
                    log(`wifi ${JSON.stringify(wifi, null, 2)}`);
                    if (wifi.SSID === req.body.SSID) {
                        if (wifi.AUTH_SUITE) {
                            switch (wifi.AUTH_SUITE) {
                                case 'PSK':
                                    command = `connectWiFi ${req.body.SSID} psk-mixed ${req.body.PASS}`;
                                    break;
                                case 'WPA':
                                    command = `connectWiFi ${req.body.SSID} wpa-mixed ${req.body.PASS}`;
                                default:
                                    command = `connectWiFi ${req.body.SSID} ${wifi.AUTH_SUITE} ${req.body.PASS}`;
                                    break;
                            }
                            connectWifi(command, req, res);
                        }
                        else {
                            command = `connectWiFi ${req.body.SSID}`;
                            connectWifi(command, req, res);
                        }
                    }
                })).catch(error => log(error));
            }
            else {
                res.statusCode = 400;
                res.end(JSON.stringify({ message: 'malformed request' }));
            }
        });
    function parseWifi(wifi_string: string) {
        log(`unparsed_string: ${wifi_string}`);
        const items = wifi_string
            .trim() // remove trailing whitespaces and \n at end of string
            .split('\n') // break out each output into its own line
            .map(line => line.trim().slice(1, line.length - 1).split('][')) // return an array of things inside [...]
            .reduce((wifis: WifiObject[], line: string[]) => {
                const item = {
                    SSID: '',
                    CIPHER: '',
                    AUTH_SUITE: ''
                };
                item.SSID = line[0];
                item.CIPHER = line[1];
                item.AUTH_SUITE = line[2];
                wifis.push(item);
                return wifis;
            }, []);
        log(`items: ${JSON.stringify(items, null, 2)}`);
        return items;
    }
    function createWap(SSID: string) {
        const childProcess = require('child_process');
        const command = `createWAP ${SSID}`;
        log(command);
        childProcess.exec(command, (error: any, stdout: any, stderr: any) => {
            log(stdout);
        });
    }
    function scanWifi() {
        const childProcess = require('child_process');
        return new Promise((resolve, reject) => {
            childProcess.exec('scanWifi', (error: any, stdout: any, stderr: any) => {
                if (error)
                    reject(error);
                else {
                    const items = parseWifi(stdout);
                    resolve(items);
                }
            });
            // resolve(parseWifi('[Stanley Homes Inc][TKIP][PSK]\n[Stanley Homes Inc-guest][OPEN][]\n[Foxconn OEM][OPEN][]\n[droplit][CCMP][PSK]\n[CableWiFi][OPEN][]'));
        });
    }
    function connectWifi(command: string, req: any, res: http.ServerResponse) {
        const childProcess = require('child_process');
        log(`command: ${command}`);
        childProcess.exec(command, (error: any, stdout: any, stderr: any) => {
            if (error) {
                log(error);
                createWap(SSID);
                res.statusCode = 500;
                res.end(error);
            } else {
                res.statusCode = 200;
                const result = {
                    message: `Connected to AP: ${(<any>req).body.SSID}`
                };
                res.end(JSON.stringify(result));
            }
            log(stdout);
        });
    }
};
