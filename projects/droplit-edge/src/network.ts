import * as childProcess from 'child_process';
import * as http from 'http';
const bodyParser = require('body-parser');
const router = require('router')();

export class Network {
    private PORT: number;
    server: http.Server;
    edgeId: string;

    constructor(edgeId: string, port = 81) {
        this.PORT = port;
        this.edgeId = edgeId;
        this.server = http.createServer((request, response) => {
            router(request, response, require('finalhandler')(request, response));
        });

        this.server.listen(this.PORT, () => {
            console.log('Listening on port:', this.PORT);
        });

        router.use(bodyParser.json());

        router.route('/droplit-edge-info')
            .get((req: http.ServerRequest, res: http.ServerResponse) => {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                const result = {
                    status: 200,
                    edgeId: this.edgeId
                };
                console.log('REQ: RECEIVED: ');
                res.end(JSON.stringify(result));
            });
        router.route('/config/wifi')
            .get((req: http.ServerRequest, res: http.ServerResponse) => {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                let wifis = '';
                childProcess.exec('scanWifi', (error: any, stdout: any, stderr: any) => {
                    if (error)
                        console.log(error);
                    console.log(stdout);
                    wifis = stdout;
                    const result = {
                        status: 200,
                        items: wifis
                    };
                    res.end(JSON.stringify(result));
                });
            })
            .put((req: http.ClientRequest, res: http.ServerResponse) => {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                let result: any;
                console.log((<any>req).body);

                childProcess.exec(`connectWiFi ${(<any>req).body.SSID} ${(<any>req).body.passPhrase}`, (error: any, stdout: any, stderr: any) => {
                    if (error) {
                        console.log(error);
                    } else {
                        result = {
                            status: 200,
                            message: `Connected to AP: ${(<any>req).body.SSID}`
                        };
                    }
                    console.log(stdout);
                });

                res.end(JSON.stringify(result));
            });

    }
}