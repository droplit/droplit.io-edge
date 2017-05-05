import 'droplit-edge';
import * as droplitSdk from 'droplit-sdk';
import * as droplitWebsocketSdk from 'droplit-websocket-sdk';
import 'mocha';
import { expect } from 'chai';
import * as http from 'http';
import * as ngrok from 'ngrok';

const droplitEdgeSettings = require('../../droplit-edge/localsettings.json');
const localSettings = require('../localsettings.json');

const droplit = new droplitSdk.Droplit();
droplit.initialize(localSettings.baseUri, localSettings.clientId, localSettings.authToken);

const droplitClient = new droplitWebsocketSdk.DroplitClient(localSettings.baseUri);
droplitClient.on('authenticateRequest', () => {
    droplitClient.authenticate(localSettings.authToken);
});

// give the edge server time to setup
before(function (done) {
    this.timeout(10000);

    setTimeout(() => {
        done();
    }, 5000);
});

describe('Ecosystems, Environments, Devices, and Zones', function () {
    this.timeout(10000);

    let ecosystemId: string;
    let environmentId: string;
    const deviceIds: string[] = [];
    let zoneId: string;

    after(function (done) {
        droplit.ecosystems.deleteEcosystem(ecosystemId).then(value => {
            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create an ecosystem', function (done) {
        droplit.ecosystems.create().then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            ecosystemId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the ecosystem exists', function (done) {
        droplit.ecosystems.info(ecosystemId).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.id).to.equal(ecosystemId);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create an environment', function (done) {
        droplit.environments.create({ ecosystemId }).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            environmentId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the environment exists', function (done) {
        droplit.environments.info(environmentId).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.id).to.equal(environmentId);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a virtual device', function (done) {
        droplit.devices.create({ environmentId }).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            deviceIds[0] = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the device exists', function (done) {
        droplit.devices.info(deviceIds[0]).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.id).to.equal(deviceIds[0]);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Set a service property on a virtual device', function (done) {
        droplit.devices.setServiceProperty(deviceIds[0], 'BinarySwitch.switch', {
            value: 'on'
        }).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the property value has changed', function (done) {
        droplit.devices.getServiceProperty(deviceIds[0], 'BinarySwitch.switch', 'false').then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.items).to.exist;
            expect(value.body.items).to.have.lengthOf(1);
            expect(value.body.items[0].value).to.equal('on');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Update the device record', function (done) {
        droplit.devices.update(deviceIds[0], {
            meta: {
                $label: 'New Label'
            }
        }).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the record has been updated', function (done) {
        droplit.devices.info(deviceIds[0]).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.meta.$label).to.exist;
            expect(value.body.meta.$label).to.equal('New Label');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create and add a second device to the environment', function (done) {
        droplit.devices.create({ environmentId }).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            deviceIds[1] = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Set a service property on the environment', function (done) {
        droplit.environments.setServiceProperty(environmentId, 'BinarySwitch.switch', {
            value: 'on'
        }).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the property has been set on both devices', function (done) {
        let devicesChecked = 0;

        deviceIds.forEach((deviceId, index) => {
            droplit.devices.getServiceProperty(deviceId, 'BinarySwitch.switch', 'false').then(value => {
                expect(value.status).to.equal(200);
                expect(value.body.items).to.exist;
                expect(value.body.items).to.have.lengthOf(1);
                expect(value.body.items[0].value).to.equal('on');

                if (++devicesChecked === 2) {
                    done();
                }
            }).catch(error => {
                done(error);
            });
        });
    });

    it('Create a third device in the environment', function (done) {
        droplit.devices.create({ environmentId }).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            deviceIds[2] = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a zone', function (done) {
        droplit.zones.create({ environmentId }).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            zoneId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the zone exists', function (done) {
        droplit.zones.info(zoneId).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.id).to.equal(zoneId);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Add the first device to the zone, add the second device to the zone', function (done) {
        let devicesAdded = 0;

        deviceIds.forEach((deviceId, index) => {
            if (index === 2) {
                return;
            }
            droplit.zones.addItem(zoneId, deviceId).then(value => {
                expect(value.status).to.equal(201);

                if (++devicesAdded === 2) {
                    done();
                }
            });
        });
    });

    it('Verify that both devices and no others are in the zone', function (done) {
        droplit.zones.listItems(zoneId).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.items).to.exist;
            expect(value.body.items).to.have.lengthOf(2);

            deviceIds.forEach((deviceId, index) => {
                if (index === 2) {
                    return;
                }

                expect(value.body.items.some(item => {
                    return item.itemId === deviceId;
                })).to.be.true;
            });

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Set a service property on the zone', function (done) {
        droplit.zones.setServiceProperty(zoneId, 'BinarySwitch.switch', {
            value: 'on'
        }).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that device 1 and 2 have the property set, but not device 3', function (done) {
        let devicesChecked = 0;

        deviceIds.forEach((deviceId, index) => {
            droplit.devices.getServiceProperty(deviceId, 'BinarySwitch.switch', 'false').then(value => {
                expect(value.status).to.equal(200);
                expect(value.body.items).to.exist;

                if (index === 2) {
                    expect(value.body.items).to.have.lengthOf(0);
                } else {
                    expect(value.body.items).to.have.lengthOf(1);
                    expect(value.body.items[0].value).to.equal('on');
                }

                if (++devicesChecked === 3) {
                    done();
                }
            }).catch(error => {
                done(error);
            });
        });
    });
});

describe('Edge Device, Websockets, and Webhooks', function () {
    this.timeout(10000);

    const ecosystemId = droplitEdgeSettings.ecosystemId;
    let environmentId: string;
    let webhookId: string;
    const deviceIds: string[] = [];
    let webhookUrl: string;
    let server: http.Server;
    const port = 3001;
    let callback = function (body: any) {

    };

    before(function (done) {
        server = http.createServer((req, res) => {
            let body = '';
            req.on('data', data => {
                body += data;
            });
            req.on('end', () => {
                callback(body);
            });

            res.writeHead(200);
            res.end();
        });

        server.listen(port, 'localhost', () => {
            ngrok.connect(port, (err: any, url: any) => {
                webhookUrl = url;

                done();
            });
        });
    });

    after(function (done) {
        server.close();
        ngrok.disconnect(webhookUrl);

        let environmentDeleted = false;
        let webhookDeleted = false;

        droplit.environments.deleteEnvironment(environmentId).then(value => {
            environmentDeleted = true;

            if (webhookDeleted) {
                done();
            }
        }).catch(error => {
            done(error);
        });

        droplit.webhooks.deleteWebhook(webhookId).then(value => {
            webhookDeleted = true;

            if (environmentDeleted) {
                done();
            }
        }).catch(error => {
            done(error);
        });
    });

    it('Setup webhook', function (done) {
        droplit.webhooks.create(ecosystemId, webhookUrl).then(value => {
            expect(value.status).to.equal(201);

            webhookId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify webhook is valid', function (done) {
        droplit.webhooks.invokeWebhook(webhookId).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Get the environment from the running edge server', function (done) {
        droplit.environments.list(ecosystemId).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.items).to.exist;
            expect(value.body.items).to.have.lengthOf(1);

            environmentId = value.body.items[0].id;

            droplitClient.subscribe(environmentId);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Identify devices that have been created by running edge server', function (done) {
        droplit.devices.list(environmentId).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.items).to.exist;
            expect(value.body.items).to.have.length.above(0);

            value.body.items.forEach((item, index) => {
                deviceIds[index] = item.id;
            });

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Set a property on a device', function (done) {
        droplit.devices.setServiceProperty(deviceIds[1], 'BinarySwitch.switch', {
            value: 'on'
        }).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify the property has been set using refresh = false', function (done) {
        droplit.devices.getServiceProperty(deviceIds[1], 'BinarySwitch.switch', 'false').then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.items).to.exist;
            expect(value.body.items).to.have.lengthOf(1);
            expect(value.body.items[0].value).to.equal('on');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify the property has been set using refresh = true', function (done) {
        droplit.devices.getServiceProperty(deviceIds[1], 'BinarySwitch.switch', 'true').then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.items).to.exist;
            expect(value.body.items).to.have.lengthOf(1);
            expect(value.body.items[0].value).to.equal('on');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Test set and changed messages', function (done) {
        let websocketSet = false;
        let websocketChanged = false;
        let webhookSet = false;
        let webhookChanged = false;

        droplitClient.on('event', (data: any) => {
            if (data.deviceId !== deviceIds[1]) {
                return;
            }

            switch (data.type) {
                case 'set':
                    websocketSet = true;
                    break;
                case 'changed':
                    websocketChanged = true;
                    break;
            }
        });

        callback = function (body) {
            body = JSON.parse(body);
            if (body.deviceId !== deviceIds[1]) {
                return;
            }

            switch (body.type) {
                case 1:
                    webhookSet = true;
                    break;
                case 4:
                    webhookChanged = true;
                    break;
            }
        };

        droplit.devices.setServiceProperty(deviceIds[1], 'BinarySwitch.switch', {
            value: 'on'
        });

        setTimeout(() => {
            droplitClient.removeAllListeners('event');

            callback = function (body) {

            };

            try {
                expect(websocketSet).to.be.true;
                expect(websocketChanged).to.be.true;
                expect(webhookSet).to.be.true;
                expect(webhookChanged).to.be.true;
            } catch (error) {
                done(error);

                return;
            }

            done();
        }, 5000);
    });

    it('Test service methods and events', function (done) {
        let websocketCall = false;
        let websocketEvent = false;
        let webhookCall = false;
        let webhookEvent = false;

        droplitClient.on('event', (data: any) => {
            if (data.deviceId !== deviceIds[1]) {
                return;
            }

            switch (data.type) {
                case 'call':
                    websocketCall = true;
                    break;
                case 'event':
                    websocketEvent = true;
                    break;
            }
        });

        callback = function (body) {
            body = JSON.parse(body);
            if (body.deviceId !== deviceIds[1]) {
                return;
            }

            switch (body.type) {
                case 2:
                    webhookCall = true;
                    break;
                case 3:
                    webhookEvent = true;
                    break;
            }
        };

        droplit.devices.callServiceMethod(deviceIds[1], 'Test.doStuff', {});

        setTimeout(() => {
            droplitClient.removeAllListeners('event');

            callback = function (body) {

            };

            try {
                expect(websocketCall).to.be.true;
                expect(websocketEvent).to.be.true;
                expect(webhookCall).to.be.true;
                expect(webhookEvent).to.be.true;
            } catch (error) {
                done(error);

                return;
            }

            done();
        }, 5000);
    });
});

describe('History', function () {
    this.timeout(10000);

    let ecosystemId: string;
    let environmentId: string;
    let deviceId: string;

    after(function (done) {
        droplit.ecosystems.deleteEcosystem(ecosystemId).then(value => {
            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create an ecosystem', function (done) {
        droplit.ecosystems.create().then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            ecosystemId = value.body.id;

            done();
        });
    });

    it('Create an environment', function (done) {
        droplit.environments.create({ ecosystemId }).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            environmentId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a virtual device', function (done) {
        droplit.devices.create({ environmentId }).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            deviceId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Turn a service property on', function (done) {
        droplit.devices.setServiceProperty(deviceId, 'BinarySwitch.switch', {
            value: 'on'
        }).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Turn a service property on', function (done) {
        droplit.devices.setServiceProperty(deviceId, 'BinarySwitch.switch', {
            value: 'off'
        }).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Call a service method on the device', function (done) {
        droplit.devices.callServiceMethod(deviceId, 'BinarySwitch.switchOn', {}).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify device history is correct', function (done) {
        droplit.devices.history(deviceId, '').then(value => {
            expect(value.status).to.equal(200);
            expect((<any>value.body).items).to.have.lengthOf(3);

            (<any>value.body).items.forEach((item: any, index: number) => {
                switch (index) {
                    case 0:
                        expect(item.type).to.equal('call');
                        break;
                    case 1:
                        expect(item.type).to.equal('set');
                        expect(item.value).to.equal('off');
                        break;
                    case 2:
                        expect(item.type).to.equal('set');
                        expect(item.value).to.equal('on');
                        break;
                }
            });

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify environment history is correct', function (done) {
        droplit.environments.history(environmentId, '').then(value => {
            expect(value.status).to.equal(200);
            expect((<any>value.body).items).to.have.lengthOf(3);

            (<any>value.body).items.forEach((item: any, index: number) => {
                switch (index) {
                    case 0:
                        expect(item.type).to.equal('call');
                        break;
                    case 1:
                        expect(item.type).to.equal('set');
                        expect(item.value).to.equal('off');
                        break;
                    case 2:
                        expect(item.type).to.equal('set');
                        expect(item.value).to.equal('on');
                        break;
                }
            });

            done();
        }).catch(error => {
            done(error);
        });
    });
});

describe('Users', function () {
    this.timeout(10000);

    let ecosystemId: string;
    const environmentIds: string[] = [];
    const deviceIds: string[] = [];
    let zoneId: string;
    let userId: string;

    after(function (done) {
        droplit.setAuthorization(localSettings.authToken);

        droplit.ecosystems.deleteEcosystem(ecosystemId).then(value => {
            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create an ecosystem', function (done) {
        droplit.ecosystems.create().then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            ecosystemId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create an environment', function (done) {
        droplit.environments.create({ ecosystemId }).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            environmentIds[0] = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create another environment', function (done) {
        droplit.environments.create({ ecosystemId }).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            environmentIds[1] = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a virtual device in the first environment', function (done) {
        droplit.devices.create({ environmentId: environmentIds[0] }).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            deviceIds[0] = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a virtual device in the second environment', function (done) {
        droplit.devices.create({ environmentId: environmentIds[1] }).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            deviceIds[1] = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a user and grant access to the first environment', function (done) {
        userId = ecosystemId + ';testUser';

        droplit.users.update(userId, {
            access: [
                {
                    environmentId: environmentIds[0],
                    accessLevel: 'Full'
                }
            ],
            email: 'test@test.com',
            meta: {
                $label: 'Test User'
            }
        }, '?generateToken=true').then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.token).to.exist;

            droplit.setAuthorization(value.body.token);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Fail to list ecosystems', function (done) {
        droplit.ecosystems.list().then(value => {
            expect(value.body).to.equal('Token type not permitted!');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('List environments', function (done) {
        droplit.environments.list(ecosystemId).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.items).to.exist;
            expect(value.body.items).to.have.lengthOf(1);
            expect(value.body.items[0].id).to.equal(environmentIds[0]);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('List devices', function (done) {
        droplit.devices.list(environmentIds[0]).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.items).to.exist;
            expect(value.body.items).to.have.lengthOf(1);
            expect(value.body.items[0].id).to.equal(deviceIds[0]);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Fail to list devices in the second environment', function (done) {
        droplit.devices.list(environmentIds[1]).then(value => {
            expect(value.body).to.equal('Token type not permitted!');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Set device service property', function (done) {
        droplit.devices.setServiceProperty(deviceIds[0], 'BinarySwitch.switch', {
            value: 'on'
        }).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Update device record', function (done) {
        droplit.devices.update(deviceIds[0], {
            meta: {
                $label: 'New Label'
            }
        }).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a zone', function (done) {
        droplit.zones.create({ environmentId: environmentIds[0] }).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            zoneId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Add the first device to the zone', function (done) {
        droplit.zones.addItem(zoneId, deviceIds[0]).then(value => {
            expect(value.status).to.equal(201);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Fail to add the second device to the zone', function (done) {
        droplit.zones.addItem(zoneId, deviceIds[1]).then(value => {
            expect(value.body).to.equal('Token type not permitted!');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Fail to delete the ecosystem', function (done) {
        droplit.ecosystems.deleteEcosystem(ecosystemId).then(value => {
            expect(value.body).to.equal('Token type not permitted!');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Delete the first device', function (done) {
        droplit.devices.delete(deviceIds[0]).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Delete the first environment', function (done) {
        droplit.environments.deleteEnvironment(environmentIds[0]).then(value => {
            expect(value.status).to.equal(200);

            done();
        }).catch(error => {
            done(error);
        });
    });
});

describe('Clients', function () {
    this.timeout(10000);

    let ecosystemId: string;
    let clientId: string;
    let tokenId: string;
    let token: string;

    after(function (done) {
        droplit.ecosystems.deleteEcosystem(ecosystemId).then(value => {
            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create an ecosystem', function (done) {
        droplit.ecosystems.create().then(value => {
            expect(value.status).to.equal(201);
            expect(value.body).to.exist;

            ecosystemId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a client', function (done) {
        droplit.clients.create(ecosystemId, 'application').then(value => {
            expect(value.status).to.equal(201);

            clientId = value.body.id;

            done();
        });
    });

    it('Verify the client exists', function (done) {
        droplit.clients.info(clientId).then(value => {
            expect(value.status).to.equal(200);

            done();
        });
    });

    it('Update the client info', function (done) {
        droplit.clients.update(clientId, {
            name: 'Test Client'
        }).then(value => {
            expect(value.status).to.equal(200);

            done();
        });
    });

    it('Verify the client info has been updated', function (done) {
        droplit.clients.info(clientId).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.name).to.exist;
            expect(value.body.name).to.equal('Test Client');

            done();
        });
    });

    it('Create a client token', function (done) {
        droplit.tokens.create(clientId).then(value => {
            expect(value.status).to.equal(201);

            tokenId = value.body.id;
            token = value.body.token;

            done();
        });
    });

    it('Verify the token exists', function (done) {
        droplit.tokens.info(clientId, tokenId).then(value => {
            expect(value.status).to.equal(200);

            done();
        });
    });

    it('Update the token record', function (done) {
        droplit.tokens.updateToken(clientId, tokenId, {
            description: 'Primary access token'
        }).then(value => {
            expect(value.status).to.equal(200);

            done();
        });
    });

    it('Verify the token record has been updated', function (done) {
        droplit.tokens.info(clientId, tokenId).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.description).to.exist;
            expect(value.body.description).to.equal('Primary access token');

            done();
        });
    });

    it('Regenerate the client token and verify it is different', function (done) {
        droplit.tokens.regenerateToken(clientId, tokenId).then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.token).to.exist;
            expect(value.body.token).to.not.equal(token);

            token = value.body.token;

            done();
        });
    });
});

describe('Service classes', function () {
    this.timeout(10000);

    let ecosystemId: string;

    after(function (done) {
        droplit.ecosystems.deleteEcosystem(ecosystemId).then(value => {
            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create an ecosystem', function (done) {
        droplit.ecosystems.create().then(value => {
            expect(value.status).to.equal(201);
            expect(value.body.id).to.exist;

            ecosystemId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a new service class', function (done) {
        droplit.serviceClasses.create(ecosystemId, 'Test').then(value => {
            expect(value.status).to.equal(201);

            done();
        });
    });

    it('Verify the service class exists', function (done) {
        droplit.serviceClasses.list(ecosystemId).then(value => {
            expect(value.status).to.equal(200);
            expect(value.body.items).to.exist;
            expect(value.body.items).to.have.lengthOf(1);
            expect(value.body.items[0].name).to.equal('Test');

            done();
        });
    });
});
