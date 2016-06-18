import * as request from 'request';
import * as events from 'events';
import * as url from 'url';

let EventEmitter = events.EventEmitter;
let ssdp = require('node-ssdp').Client;
ssdp = new ssdp();

let upnpSearch: string = 'venstar:thermostat:ecp';

let found: any = {};


export interface Response {
    status: number;
    body?: any;
}

ssdp.on('response', (headers: any, statusCode: any, rinfo: any) => {
    if (!headers.LOCATION || !headers.ST || !headers.USN) {
        console.log('no LOCATION || ST, || USN');
        return;
    }

    let ipRegEx = new RegExp("([^http/]+)");
    let idRegEx = new RegExp('^voyager:ecp:([a-zA-Z0-9.]+)');

    let idMatch = headers.USN.match(idRegEx);
    let ipMatch = 'http://' + headers.LOCATION.match(ipRegEx)[1] + '/';

    if (!idMatch) {
        return;
    }

    let identifier = idMatch[1];
    if (identifier in found) {
        if (found.identifier.location.hostname === rinfo.address) {
            console.log('Same ip');
            return;
        }
        // IP address has changed since last discovery
        found.identifier.location = url.parse(headers.LOCATION);
        // emit('ipchange', { identifier: identifier, ip: found.identifier.location });
        return;
    }

    let discoveryData = {
        address: rinfo.address,
        identifier,
        location: url.parse(ipMatch),
        port: rinfo.port,
        server: headers.SERVER
    };

    discoveryData.location.hostname = rinfo.address;

    query(discoveryData.location.href).then((result) => {
        console.log(`"Space" temperature ${result.body.spacetemp}`);
        console.log(`Mode ${result.body.mode}`);
        console.log(`Fan ${result.body.fan}`);
        console.log(`Cooltemp ${result.body.cooltemp}`);
        console.log(`Heattemp ${result.body.heattemp}`);
        console.log(`Setpointdelta ${result.body.setpointdelta}`);
        let mode = result.body.fan;
        if(mode == 0){
            mode = 1;
        } else {
            mode = 0;
        }
        control(discoveryData.location.href, "fan", mode).then((result) => {
            console.log(result);
            query(discoveryData.location.href).then((result) => {
                console.log(`\n"Space" temperature ${result.body.spacetemp}`);
                console.log(`Mode ${result.body.mode}`);
                console.log(`Fan ${result.body.fan}`);
                console.log(`Cooltemp ${result.body.cooltemp}`);
                console.log(`Heattemp ${result.body.heattemp}`);
                console.log(`Setpointdelta ${result.body.setpointdelta}\n`);
            });
        }).catch((result) => {
            console.log(result);
            query(discoveryData.location.href).then((result) => {
                console.log(`\n"Space" temperature ${result.body.spacetemp}`);
                console.log(`Mode ${result.body.mode}`);
                console.log(`Fan ${result.body.fan}`);
                console.log(`Cooltemp ${result.body.cooltemp}`);
                console.log(`Heattemp ${result.body.heattemp}`);
                console.log(`Setpointdelta ${result.body.setpointdelta}\n`);
            });
        });
    });
    // sensor(discoveryData.location.href).then((result) => {
    //     result.body.forEach((element: any) => {
    //         if (element.name === 'Thermostat') {
    //             console.log('Thermostat temperature:', element.temp);
    //         }
    //     });
    // });
    // control(discoveryData.location.href, "heattemp", 65).then((result) => {
    //     console.log(result);
    // }).catch((error) => {
    //     console.log(error);
    // });


    // console.log(discoveryData);
    found = { identifier: discoveryData };

    /**
     * Functions for API
     */
    function query(localId: string): Promise<Response> {
        return new Promise<Response>((resolve, reject) => {
            request.get({
                url: localId + 'query/info'
            }, (error, response, body) => {
                if (!error) {
                    let res: Response = { status: response.statusCode };
                    if (body === '') {
                        res.body = null;
                    } else {
                        res.body = JSON.parse(body);
                    }
                    resolve(res);
                } else {
                    reject(error);
                }
            });
        });
    }
    function sensor(localId: string): Promise<Response> {
        return new Promise<Response>((resolve, reject) => {
            request.get({
                url: localId + 'query/sensors'
            }, (error, response, body) => {
                if (!error) {
                    let res: Response = { status: response.statusCode };
                    if (body === '') {
                        res.body = null;
                    } else {
                        res.body = JSON.parse(body).sensors;
                    }
                    resolve(res);
                } else {
                    console.log(error);
                    reject(error);
                }
            });
        });
    }
    function alert(localId: string): Promise<Response> {
        return new Promise<Response>((resolve, reject) => {
            request.get({
                url: localId + 'query/alerts'
            }, (error, response, body) => {
                if (!error) {
                    let res: Response = { status: response.statusCode };
                    if (body === '') {
                        res.body = null;
                    } else {
                        res.body = JSON.parse(body);
                    }
                    resolve(res);
                } else {
                    console.log(error);
                    reject(error);
                }
            });
        });
    }

    function control(localId: string, property: string, value: number): Promise<Response> {
        return new Promise<Response>((resolve, reject) => {
            query(localId).then((result) => {
                let controls: any = {};

                if (property === "mode") {
                    controls.mode = value;
                    controls.heattemp = result.body.heattemp;
                    controls.cooltemp = result.body.cooltemp;
                    if (value === 3) {
                        if (controls.cooltemp < controls.heattemp) {
                            reject(`Cool temp must be at least ${result.body.setpointdelta} greater than heat temp`);
                        }
                    }
                    controlPost(localId, controls).then((postResult) => {
                        resolve(postResult);
                    });
                } else if (property === "fan") {
                    controls.fan = value;
                    request.debug = true;
                    controlPost(localId, controls).then((postResult) => {
                        resolve(postResult);
                    }).catch((postResult) => {
                        request.debug = false;
                        setTimeout(() => {
                            query(localId).then((queryResult) => {
                                let res: Response = { status: 200 };
                                if (queryResult.body.fan === value) {
                                    res.body = 'fan changed';
                                    resolve(res);
                                } else {
                                    res.status = 400;
                                    res.body = 'fan error';
                                    reject(res);
                                }
                            });
                        }, 3000);
                    });
                } else {
                    controls[property] = value;
                    console.log(controls);
                    controlPost(localId, controls).then((postResult) => {
                        resolve(postResult);
                    }).catch((postResult) => {
                        reject(postResult);
                    });
                }

            });
        });
    }
    function controlPost(localId: string, object: any) {
        return new Promise<Response>((resolve, reject) => {
            request.post(localId + 'control',
                { form: object },
                (error, response, body) => {
                    if (!error) {
                        let res: Response = { status: response.statusCode };
                        if (body === '') {
                            res.body = null;
                        } else {
                            res.body = JSON.parse(body);
                            if (res.body.error === true) {
                                reject(res);
                            }
                        }
                        resolve(res);
                    } else {
                        console.log(error);
                        reject(error);
                    }
                });
        });
    }

});

function getDescription(identifier: any) {
    console.log('description: ', identifier);
}

// ssdp.on('response', (headers, statusCode, rinfo) => {
//     if (header.USN === )
//     console.log(headers, statusCode, rinfo);
// });


console.log('searching');
ssdp.search(upnpSearch); // Update after finding the ST

setTimeout(function () {
    ssdp.stop();
}, 5000);
