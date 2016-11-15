import * as events from 'events';
import * as request from 'request';

export interface Response {
    status: number;
    body?: any;
}
enum Mode {
    off,
    heat,
    cool,
    auto
}
enum Fan {
    auto,
    on
}
enum UnitMode {
    fahrenheit,
    celsius
}
enum State {
    idle,
    heating,
    cooling,
    lockout,
    error
}
enum Away {
    home,
    away
}

export class VoyagerClient extends events.EventEmitter {

    services: any;
    device: any;

    constructor(init: any) {
        super();

        this.device = {};

        this.device.address = init.location.href;
        this.device.identifier = init.identifier;
        this.device.deferred = false;

        this.query().then((result: any) => {
            // this.device.temperature = result.body.spacetemp;
            // this.device.mode = result.body.mode;
            // this.device.fan = result.body.fan;
            // this.device.heattemp = result.body.heattemp;
            // this.device.cooltemp = result.body.cooltemp;
            // this.device.setpointdelta = result.body.setpointdelta;
            // this.device.temperatureType = result.body.tempunits;
            // this.device.state = result.body.state;
            // this.device.tempunits = result.body.tempunits;
        }).then(() => {
            this.device.interval = setInterval(() => {
                if (!this.device.deferred) {
                    this.findChanges()
                    .then(result => this.device.changes = result)
                    .then(() => {
                        if (this.device.changes.stateChanged)
                            this.emit('propertiesChanged', this.device.changes.properties);
                    })
                    .catch(() => {}); // Do not want to actually do anything on reject; however, need to handle to avoid 6.6.0 warning
                }
                this.device.deferred = false;
            }, 5000);
        });

    }

    getMode(callback: any) {
        this.query().then((result) => {
            callback(Mode[result.body.mode]);
        });
    }
    setMode(value: string) {
        const mode = <any>Mode[<any>value];
        this.control('mode', mode).then((result) => {
            // console.log(result);
        });
    }
    getFan(callback: any) {
        this.query().then((result) => {
            callback(Fan[result.body.fan]);
        });
    }
    setFan(value: string) {
        const fan = <any>Fan[<any>value];
        this.control('fan', fan).then((result) => {
            // console.log(result);
        });
    }
    getCool(callback: any) {
        this.query().then((result) => {
            const temperature = {
                value: result.body.cooltemp,
                unit: ((result.body.tempunits === 0) ? 'F' : 'C')
            }
            callback(temperature);
        });
    }
    setCool(value: number, units?: string) {
        if (!units) {
            this.control('cooltemp', value).then((result) => {
                // console.log(result);
            });
        } else {
            let currentUnits: string;
            let temperature: number;
            this.query().then((result) => {
                currentUnits = UnitMode[result.body.tempunits];
                temperature = (currentUnits === units) ? value : undefined;
                if ((currentUnits ===  'fahrenheit') && (units === 'celsius')) {
                    temperature = (value * (9 / 5)) + 32; // given fahrenheit to celsius
                }
                if ((currentUnits ===  'celsius') && (units === 'fahrenheit')) {
                    temperature = (value - 32) * (5 / 9); // given celsius to fahrenheit
                }
            }).then(() => {
                // console.log(value, temperature);
                this.control('cooltemp', temperature).then((result) => {
                    // console.log(result);
                });
            });
        }
    }
    getHeat(callback: any) {
        this.query().then((result) => {
            let temperature = {
                value: result.body.heattemp,
                unit: ((result.body.tempunits === 0) ? 'F' : 'C')
            }
            callback(temperature);
        });
    }
    setHeat(value: number, units?: string) {
        if (!units) {
            this.control('heattemp', value).then((result) => {
                // console.log(result);
            });
        } else {
            let currentUnits: string;
            let temperature: number;
            this.query().then((result) => {
                currentUnits = UnitMode[result.body.tempunits];
                temperature = (currentUnits === units) ? value : undefined;
                if ((currentUnits ===  'fahrenheit') && (units === 'celsius')) {
                    temperature = (value * (9 / 5)) + 32; // given fahrenheit to celsius
                }
                if ((currentUnits ===  'celsius') && (units === 'fahrenheit')) {
                    temperature = (value - 32) * (5 / 9); // given celsius to fahrenheit
                }
            }).then(() => {
                // console.log(value, temperature);
                this.control('heattemp', temperature).then((result) => {
                    // console.log(result);
                });
            });
        }
    }
    getTemperature(callback: any) {
        this.query().then((result) => {
            const temperature = {
                value: result.body.spacetemp,
                unit: ((result.body.tempunits === 0) ? 'F' : 'C')
            }
            callback(temperature);
        });
    }
    getUnits(callback: any) {
        this.query().then((result) => {
            callback(UnitMode[result.body.tempunits]);
        });
    }
    setUnits(value: string) {
        const tempunits = <any>UnitMode[<any>value];
        this.setting('tempunits', tempunits).then((result) => {
            // console.log(result);
        });
    }
    getState(callback: any) {
        this.query().then((result) => {
            callback(State[result.body.state]);
        });
    }
    getAway(callback: any) {
        this.query().then((result) => {
            callback(Away[result.body.away] === 'away');
        });
    }
    setAway(value: boolean) {
        let away: number;
        if (value) {
            away = Away['away'];
        } else {
            away = Away['home'];
        }
        this.setting('away', away).then((result) => {
        });
    }
    // getAirFilter(callback: any) {
    //     this.alert(localId).then((result) => {
    //         return
    //     });
    // }

    findChanges() {
        return new Promise<Response>((resolve, reject) => {
            let changes: any = {
                stateChanged: false,
                properties: []
            };
            this.query().then((result: any) => {
                if (this.device.temperature !== result.body.spacetemp) {
                    changes.properties.push({
                        localId: this.device.identifier,
                        service: 'Temperature',
                        member: 'temperature',
                        value: {
                            value: result.body.spacetemp,
                            unit: ((result.body.tempunits === 0) ? 'F' : 'C')
                        }
                    });
                    this.device.temperature = result.body.spacetemp;
                    changes.stateChanged = true;
                }
                if (this.device.mode !== result.body.mode) {
                    changes.properties.push({
                        localId: this.device.identifier,
                        service: 'Thermostat',
                        member: 'mode',
                        value: Mode[result.body.mode]
                    });
                    this.device.mode = result.body.mode;
                    changes.stateChanged = true;
                }
                if (this.device.fan !== result.body.fan) {
                    changes.properties.push({
                        localId: this.device.identifier,
                        service: 'Thermostat',
                        member: 'fan',
                        value: Fan[result.body.fan]
                    });
                    this.device.fan = result.body.fan;
                    changes.stateChanged = true;
                }
                if (this.device.heattemp !== result.body.heattemp) {
                    changes.properties.push({
                        localId: this.device.identifier,
                        service: 'Thermostat',
                        member: 'heatTemperature',
                        value: {
                            value: result.body.heattemp,
                            unit: ((result.body.tempunits === 0) ? 'F' : 'C')
                        }
                    });
                    this.device.heattemp = result.body.heattemp;
                    changes.stateChanged = true;
                }
                if (this.device.cooltemp !== result.body.cooltemp) {
                    changes.properties.push({
                        localId: this.device.identifier,
                        service: 'Thermostat',
                        member: 'coolTemperature',
                        value: {
                            value: result.body.cooltemp,
                            unit: ((result.body.tempunits === 0) ? 'F' : 'C')
                        }
                    });
                    this.device.cooltemp = result.body.cooltemp;
                    changes.stateChanged = true;
                }
                if (this.device.tempunits !== result.body.tempunits) {
                    changes.properties.push({
                        localId: this.device.identifier,
                        service: 'Temperature',
                        member: 'unitMode',
                        value: UnitMode[result.body.tempunits]
                    });
                    this.device.tempunits = result.body.tempunits;
                    changes.stateChanged = true;
                }
                if (this.device.state !== result.body.state) {
                    if (State[result.body.state] === <any>State[<any>'idle']) {
                        changes.properties.push({
                            localId: this.device.identifier,
                            service: 'Thermostat',
                            member: 'state',
                            value: 'off'
                        });
                    } else {
                        changes.properties.push({
                            localId: this.device.identifier,
                            service: 'Thermostat',
                            member: 'state',
                            value: State[result.body.state]
                        });
                    }
                    this.device.state = result.body.state;
                    changes.stateChanged = true;
                    // if (result.body.state === <any>State[<any>'heating']) {
                    //     console.log('case 1');
                    //     changes.properties.push({
                    //         localId: this.device.identifier,
                    //         service: 'Thermostat',
                    //         member: 'heating',
                    //         value: true
                    //     },
                    //     {
                    //         localId: this.device.identifier,
                    //         service: 'Thermostat',
                    //         member: 'cooling',
                    //         value: false
                    //     });
                    //     this.device.state = result.body.state;
                    //     changes.stateChanged = true;
                    // } else if (result.body.state === <any>State[<any>'cooling']) {
                    //     console.log('case 2');
                    //     changes.properties.push({
                    //         localId: this.device.identifier,
                    //         service: 'Thermostat',
                    //         member: 'cooling',
                    //         value: true
                    //     },
                    //     {
                    //         localId: this.device.identifier,
                    //         service: 'Thermostat',
                    //         member: 'heating',
                    //         value: false
                    //     });
                    //     this.device.state = result.body.state;
                    //     changes.stateChanged = true;
                    // } else if (result.body.state === <any>State[<any>'idle'] || result.body.state === <any>State[<any>'lockout'] || result.body.state === <any>State[<any>'error']) {
                    //     console.log('case 3');
                    //     changes.properties.push({
                    //         localId: this.device.identifier,
                    //         service: 'Thermostat',
                    //         member: 'cooling',
                    //         value: false
                    //     },
                    //     {
                    //         localId: this.device.identifier,
                    //         service: 'Thermostat',
                    //         member: 'heating',
                    //         value: false
                    //     });
                    //     this.device.state = result.body.state;
                    //     changes.stateChanged = true;
                    // }
                }
                if (this.device.away !== result.body.away) {
                    if (result.body.away === <any>Away[<any>'away']) {
                        changes.properties.push({
                            localId: this.device.identifier,
                            service: 'Thermostat',
                            member: 'away',
                            value: true
                        });
                    } else {
                        changes.properties.push({
                            localId: this.device.identifier,
                            service: 'Thermostat',
                            member: 'away',
                            value: false
                        });
                    }
                    this.device.away = result.body.away;
                    changes.stateChanged = true;
                }
            })
            .then(() => {
                if (changes.stateChanged === true) {
                    resolve(changes);
                } else {
                    reject(changes);
                }
            })
            .catch(() => {}); // Do not want to actually do anything on reject; however, need to handle to avoid 6.6.0 warning
        });
    }

    // BASE API FUNCTIONS
    query(): Promise<Response> {
        // console.log('ip:', this.device.address);
        return new Promise<Response>((resolve, reject) => {
            request.get({
                url: this.device.address + 'query/info'
            }, (error, response, body) => {
                this.device.deferred = true;
                if (!error) {
                    const res: Response = { status: response.statusCode };
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
    sensor(): Promise<Response> {
        return new Promise<Response>((resolve, reject) => {
            request.get({
                url: this.device.address + 'query/sensors'
            }, (error, response, body) => {
                this.device.deferred = true;
                if (!error) {
                    const res: Response = { status: response.statusCode };
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
    alert(): Promise<Response> {
        return new Promise<Response>((resolve, reject) => {
            request.get({
                url: this.device.address + 'query/alerts'
            }, (error, response, body) => {
                this.device.deferred = true;
                if (!error) {
                    const res: Response = { status: response.statusCode };
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

    control(property: string, value: number): Promise<Response> {
        return new Promise<Response>((resolve, reject) => {
            this.query().then((result) => {
                const controls: any = {};

                if (property === 'mode') {
                    controls.mode = value;
                    controls.heattemp = result.body.heattemp;
                    controls.cooltemp = result.body.cooltemp;
                    if (value === 3) {
                        if (controls.cooltemp < controls.heattemp) {
                            reject(`Cool temp must be at least ${result.body.setpointdelta} greater than heat temp`);
                        }
                    }
                    this.controlPost(controls).then((postResult) => {
                        resolve(postResult);
                    });
                } else if (property === 'fan') {
                    controls.fan = value;
                    this.controlPost(controls).then((postResult) => {
                        const res: Response = { status: 200 };
                        res.body = postResult.body;
                        resolve(postResult);
                    }).catch((postResult) => {
                        const res: Response = { status: 200 };
                        res.body = postResult.body;
                        reject(res);
                        /**
                         * RETRY LOGIC
                         */
                        // setTimeout(() => {
                        //     query().then((queryResult) => {
                        //         let res: Response = { status: 200 };
                        //         if (queryResult.body.fan === value) {
                        //             res.body = 'fan changed';
                        //             resolve(res);
                        //         } else {
                        //             res.status = 400;
                        //             res.body = 'fan error';
                        //             reject(res);
                        //         }
                        //     });
                        // }, 3000);
                    });
                } else if (property === 'heattemp') {
                    controls.heattemp = value;
                    if (result.body.mode === 1) {
                        this.controlPost(controls).then((postResult) => {
                            const res: Response = {
                                status: postResult.status,
                                body: postResult.body
                            };
                            resolve(res);
                        }).catch((postResult) => {
                            const res: Response = {
                                status: postResult.status,
                                body: postResult.body
                            };
                            reject(res);
                        });
                    } else if (result.body.mode === 3) {
                        if ((result.body.cooltemp) >= (value + result.body.setpointdelta)) {
                            this.controlPost(controls).then((postResult) => {
                                const res: Response = {
                                    status: postResult.status,
                                    body: postResult.body
                                };
                                resolve(res);
                            }).catch((postResult) => {
                                const res: Response = {
                                    status: postResult.status,
                                    body: postResult.body
                                };
                                reject(res);
                            });
                        } else {
                            controls.cooltemp = value + result.body.setpointdelta;
                            this.controlPost(controls).then((postResult) => {
                                const res: Response = {
                                    status: postResult.status,
                                    body: postResult.body
                                };
                                resolve(res);
                            }).catch((postResult) => {
                                const res: Response = {
                                    status: postResult.status,
                                    body: postResult.body
                                };
                                reject(res);
                            });
                        }
                    } else {
                        const res: Response = {
                            status: 400,
                            body: 'Change mode to change heattemp'
                        };
                        reject(res);
                    }
                } else if (property === 'cooltemp') {
                    controls.cooltemp = value;
                    if (result.body.mode === 2) {
                        this.controlPost(controls).then((postResult) => {
                            const res: Response = {
                                status: postResult.status,
                                body: postResult.body
                            };
                            resolve(res);
                        }).catch((postResult) => {
                            const res: Response = {
                                status: postResult.status,
                                body: postResult.body
                            };
                            reject(res);
                        });
                    } else if (result.body.mode === 3) {
                        if ((controls.cooltemp) >= (result.body.heattemp + result.body.setpointdelta)) {
                            this.controlPost(controls).then((postResult) => {
                                const res: Response = {
                                    status: postResult.status,
                                    body: postResult.body
                                };
                                resolve(res);
                            }).catch((postResult) => {
                                const res: Response = {
                                    status: postResult.status,
                                    body: postResult.body
                                };
                                reject(res);
                            });
                        } else {
                            controls.heattemp = controls.cooltemp - result.body.setpointdelta;
                            this.controlPost(controls).then((postResult) => {
                                const res: Response = {
                                    status: postResult.status,
                                    body: postResult.body
                                };
                                resolve(res);
                            }).catch((postResult) => {
                                const res: Response = {
                                    status: postResult.status,
                                    body: postResult.body
                                };
                                reject(res);
                            });
                        }
                    } else {
                        const res: Response = {
                            status: 400,
                            body: 'Change mode to change cooltemp'
                        };
                        reject(res);
                    }
                } else {
                    controls[property] = value;
                    this.controlPost(controls).then((postResult) => {
                        resolve(postResult);
                    }).catch((postResult) => {
                        reject(postResult);
                    });
                }
            });
        });
    }
    controlPost(object: any) {
        return new Promise<Response>((resolve, reject) => {
            request.post(this.device.address + 'control',
                { form: object },
                (error, response, body) => {
                    this.device.deferred = true;
                    if (!error) {
                        const res: Response = { status: response.statusCode };
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
    setting(property: string, value: number) {
        return new Promise<Response>((resolve, reject) => {
            const object: any = {};
            object[property] = value;
            request.post(this.device.address + 'settings',
                { form: object },
                (error, response, body) => {
                    this.device.deferred = true;
                    if (!error) {
                        const res: Response = { status: response.statusCode };
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
    info(callback: any) {
        request.get({
            url: this.device.address
        }, (error, response, body) => {
            this.device.deferred = true;
            if (!error) {
                const res: Response = { status: response.statusCode };
                if (body === '') {
                    res.body = null;
                } else {
                    res.body = JSON.parse(body);
                }
                callback(res);
            }
        });
    }
}
