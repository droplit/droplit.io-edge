import * as http from 'http';
import * as debug from 'debug';

const router = require('router')();
const bodyParser = require('body-parser');
const log = debug('droplit:network');
const localSettings = require('../localsettings.json');
let PORT: number;
let server: http.Server;
let SSID: string;

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
    createWap(SSID);

    server.listen(PORT, () => {
        log('Edge Server Listening on Port:', PORT);
    });

    router.use(bodyParser.json());

    router.route('/droplit-edge')
        .get((req: http.ServerRequest, res: http.ServerResponse) => {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            const result = {
                edgeId
            };
            log('REQ: RECEIVED: ');
            res.end(JSON.stringify(result));
        });
    router.route('/droplit-edge/config/wifi')
        .get((req: http.ServerRequest, res: http.ServerResponse) => {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            let wifis: any[] = [];
            const childProcess = require('child_process');
            // wifis = parseWifi('[Stanley Homes Inc\n][TKIP][PSK] [Stanley Homes Inc-guest][OPEN][] [Foxconn OEM][OPEN][] [droplit][CCMP][PSK] [CableWiFi] [OPEN][]');

            childProcess.exec('scanWifi', (error: any, stdout: any, stderr: any) => {
                if (error) {
                    res.statusCode = 501;
                    const message = {message: `${error}`};
                    res.end(JSON.stringify(message));
                    log(error);
                }
                log(stdout);
                wifis = parseWifi(stdout);

                const result: Object = {
                    items: wifis
                };
                res.end(JSON.stringify(result));
            });

        })
        .put((req: any, res: http.ServerResponse) => {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            let result: any;
            let command = '';
            let wifis = [];
            let theWifi: any;
            const childProcess = require('child_process');
            log((<any>req).body);
            if (req.body && req.body.SSID) {
                childProcess.exec('scanWifi', (error: any, stdout: any, stderr: any) => {
                    if (error)
                        log(error);
                    log(stdout);
                    wifis = parseWifi(stdout);
                    wifis.forEach(element => {
                        if (element.SSID === req.body.SSID) {
                            theWifi = element;
                        }
                    });
                    if (theWifi.MODE) {
                        switch (theWifi.MODE) {
                            case 'PSK':
                                command = `connectWiFi ${req.body.SSID} psk-mixed ${req.body.PASS}`;
                                break;
                            case 'WPA':
                                command = `connectWiFi ${req.body.SSID} wpa-mixed ${req.body.PASS}`;
                            default:
                                command = `connectWiFi ${req.body.SSID} ${theWifi.MODE} ${req.body.PASS}`;
                                break;
                        }
                        log(`command: ${command}`);
                        childProcess.exec(command, (error: any, stdout: any, stderr: any) => {
                            if (error) {
                                log(error);
                            } else {
                                res.statusCode = 200;
                                result = {
                                    message: `Connected to AP: ${(<any>req).body.SSID}`
                                };
                            }
                            log(stdout);
                        });
                        res.end(JSON.stringify(result));
                    }
                    else {
                        command = `connectWiFi ${req.body.SSID}`;
                        log(`command: ${command}`);
                        childProcess.exec(command, (error: any, stdout: any, stderr: any) => {
                            if (error) {
                                log(error);
                            } else {
                                res.statusCode = 200;
                                result = {
                                    message: `Connected to AP: ${(<any>req).body.SSID}`
                                };
                            }
                            log(stdout);
                        });
                        res.end(JSON.stringify(result));
                    }
                });
            }
            else {
                res.statusCode = 400;
                res.end(JSON.stringify({ message: 'malformed request' }));
            }
        });
    function parseWifi(wifi_string: string): any[] {
        log(`unparsed_string: ${wifi_string}`);

        const wifis: any[] = [];
        wifi_string = wifi_string.replace('\n', '');
        log(`string: ${wifi_string}`);
        const parsedWifi: string[] = wifi_string.split('');
        let counter = 0;
        let counter2 = -1;
        let counter3 = 0;
        let counter4 = 0;
        let doConcat = true;
        let name = '';
        let mode = '';
        // log('parsedWifi: '+parsedWifi);
        for (const c in parsedWifi) {

            // log('isVariable: ' + isVariable);
            // log('Character: ' + parsedWifi[c]);
            doConcat = true;
            if (parsedWifi[c] === '[') {
                doConcat = false;
                counter2++;
                counter4++;
            }
            if (parsedWifi[c] === ']') {
                doConcat = false;
                if (counter4 % 3 === 0) {
                    // log('name: ' + name);
                    // log('mode: ' + mode);
                    name = name.trim();
                    mode = mode.trim();
                    wifis[counter3] = {
                        SSID: name,
                        MODE: mode
                    };
                    name = '';
                    mode = '';
                    counter3++;
                }

                counter++;
            }
            // log('mode: ' + mode + ' ' + counter4);
            // log('name: ' + name + ' ' + counter2);
            if (doConcat && (counter2 % 3 === 0 || counter2 === 0)) {
                name += parsedWifi[c];
            }
            if (doConcat && counter4 % 3 === 0) {
                mode += parsedWifi[c];
            }
        }
        log(JSON.stringify(wifis));
        return wifis;
    }
    function createWap(SSID: string) {
        const childProcess = require('child_process');
        const command = `createWAP ${SSID}`;
        log(command);
        childProcess.exec(command, (error: any, stdout: any, stderr: any) => {
            log(stdout);
        });
    }

};
