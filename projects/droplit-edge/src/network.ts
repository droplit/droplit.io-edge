import * as http from 'http';
const bodyParser = require('body-parser');
const router = require('router')();

export class Network {
    private PORT: number;
    server: http.Server;
    edgeId: string;

    constructor(edgeId: string, port = 80) {
        this.PORT = port;
        this.edgeId = edgeId;
        this.server = http.createServer((request, response) => {
            router(request, response, require('finalhandler')(request, response));
        });

        this.server.listen(this.PORT, () => {
            console.log('Listening on port:', this.PORT);
        });

        router.use(bodyParser.json());

        router.route('/')
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
        router.route('/setup')
            .get((req: http.ServerRequest, res: http.ServerResponse) => {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                const result = {
                    status: 200,
                    items: [
                        {
                            SSID: 'someWIfi',
                            security: 'PSK'
                        },
                        {
                            SSID: 'aWIfi',
                            security: 'WPA'
                        }
                    ]
                };
                res.end(JSON.stringify(result));
            })
            .put((req: http.ServerRequest, res: http.ServerResponse) => {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                const result = {
                    status: 200,
                    message: "set AP?"
                };
                res.end(JSON.stringify(result));
            });

    }
}