import * as http from 'http';
const bodyParser = require('body-parser');
const router = require('router')();

export class Network {
    private PORT: number;
    server: http.Server;
    edgeId: string;
    SSID: string;

    constructor(edgeId: string, port = 81) {
        let SSID = edgeId.replace(new RegExp('[:-]+', 'g'), '');
        this.PORT = port;
        this.edgeId = edgeId;
        console.log(this.edgeId);
        this.SSID = SSID
        console.log(this.SSID);
        this.SSID = 'hub_' + this.SSID.slice(this.SSID.length - 4, this.SSID.length);
        this.server = http.createServer((request, response) => {
            router(request, response, require('finalhandler')(request, response));
        });

        console.log(this.SSID);
        createWap(this.SSID);


        this.server.listen(this.PORT, () => {
            console.log('Edge Server Listening on Port:', this.PORT);
        });

        router.use(bodyParser.json());

        router.route('/droplit-edge-info')
            .get((req: http.ServerRequest, res: http.ServerResponse) => {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                const result = {
                    edgeId: this.edgeId
                };
                console.log('REQ: RECEIVED: ');
                res.end(JSON.stringify(result));
            });
        router.route('/config/wifi')
            .get((req: http.ServerRequest, res: http.ServerResponse) => {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                let wifis: any[] = [];
                let childProcess = require('child_process');
                // wifis = parseWifi("[Stanley Homes Inc\n][TKIP][PSK] [Stanley Homes Inc-guest][OPEN][] [Foxconn OEM][OPEN][] [droplit][CCMP][PSK] [CableWiFi] [OPEN][]");

                childProcess.exec('scanWifi', (error: any, stdout: any, stderr: any) => {
                    if (error)
                        console.log(error);
                    console.log(stdout);
                    wifis = parseWifi(stdout);

                    let result: Object = {
                        status: 200,
                        wifis: wifis
                    };
                    res.end(JSON.stringify(result));
                });

            })
            .put((req: http.ClientRequest, res: http.ServerResponse) => {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                let result: any;
                let childProcess = require('child_process');
                console.log((<any>req).body);

                childProcess.exec(`connectWiFi ${(<any>req).body.SSID} ${(<any>req).body.passPhrase}`, (error: any, stdout: any, stderr: any) => {
                    if (error) {
                        console.log(error);
                    } else {
                        res.statusCode = 200;
                        result = {
                            message: `Connected to AP: ${(<any>req).body.SSID}`
                        };
                    }
                    console.log(stdout);
                });
                res.end(JSON.stringify(result));
            });
        function parseWifi(wifi_string: string): any[] {
            console.log('unparsed_string: ' + wifi_string);

            let wifis: any[] = [];
            wifi_string = wifi_string.replace('\n', '');
            console.log('string: ' + wifi_string);
            let parsedWifi: string[] = wifi_string.split('');
            let counter: number = 0;
            let counter2: number = -1;
            let counter3: number = 0;
            let counter4: number = 0;
            let doConcat = true;
            let name: string = "";
            let mode: string = "";
            //console.log('parsedWifi: '+parsedWifi);
            for (var c in parsedWifi) {

                //console.log('isVariable: ' + isVariable);
                //console.log('Character: ' + parsedWifi[c]);
                doConcat = true;
                if (parsedWifi[c] == '[') {
                    doConcat = false;
                    counter2++;
                    counter4++;
                }
                if (parsedWifi[c] == ']') {
                    doConcat = false;
                    if (counter4 % 3 == 0) {
                        // console.log('name: ' + name);
                        // console.log('mode: ' + mode);
                        name = name.trim();
                        mode = mode.trim();
                        wifis[counter3] = {
                            "SSID": name,
                            "MODE": mode
                        };
                        name = "";
                        mode = "";
                        counter3++;
                    }

                    counter++;
                }
                // console.log('mode: ' + mode + ' ' + counter4);
                // console.log('name: ' + name + ' ' + counter2);
                if (doConcat && (counter2 % 3 == 0 || counter2 == 0)) {
                    name += parsedWifi[c];
                }
                if (doConcat && counter4 % 3 == 0) {
                    mode += parsedWifi[c];
                }
            }
            console.log(JSON.stringify(wifis));
            return wifis;
        }
        function createWap(SSID: string) {
            let childProcess = require('child_process'), createWAP;
            let command = 'createWAP ' + SSID;
            console.log(command);
            createWAP = childProcess.exec(command, (error: any, stdout: any, stderr: any) => {
                console.log(stdout);
            });
        }
    }
}
