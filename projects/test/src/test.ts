import 'droplit-edge';
import * as droplitSdk from 'droplit-sdk';
import * as droplitWebsocketSdk from 'droplit-websocket-sdk';
import 'mocha';
import * as assert from 'assert';
import * as http from 'http';

const droplitEdgeSettings = require('../../droplit-edge/localsettings.json');
const localSettings = require('../localsettings.json');

const droplit = new droplitSdk.Droplit();
droplit.initialize(localSettings.baseUri, localSettings.clientId, localSettings.authToken);

const droplitClient = new droplitWebsocketSdk.DroplitClient(localSettings.baseUri);
droplitClient.on('authenticateRequest', function () {
    droplitClient.authenticate(localSettings.authToken);
});

// give the edge server time to setup
before(function (done) {
    this.timeout(5000);

    setTimeout(() => {
        done();
    }, 4000);
});

describe('Ecosystems, Environments, Devices, and Zones', function () {
    this.timeout(5000);

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
            assert.equal(value.status, 201, 'Ecosystem successfully created');
            assert.ok(value.body.id, 'Ecosystem has an ID');

            ecosystemId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the ecosystem exists', function (done) {
        droplit.ecosystems.info(ecosystemId).then(value => {
            assert.equal(value.status, 200, 'Ecosystem exists');
            assert.equal(value.body.id, ecosystemId, 'Ecosystem ID matches the created ecosystem ID');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create an environment', function (done) {
        droplit.environments.create({ ecosystemId }).then(value => {
            assert.equal(value.status, 201, 'Environment successfully created');
            assert.ok(value.body.id, 'Environment has an ID');

            environmentId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the environment exists', function (done) {
        droplit.environments.info(environmentId).then(value => {
            assert.equal(value.status, 200, 'Environment exists');
            assert.equal(value.body.id, environmentId, 'Environment ID matches the created environment ID');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a virtual device', function (done) {
        droplit.devices.create({ environmentId }).then(value => {
            assert.equal(value.status, 201, 'Device successfully created');
            assert.ok(value.body.id, 'Device has an ID');

            deviceIds[0] = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the device exists', function (done) {
        droplit.devices.info(deviceIds[0]).then(value => {
            assert.equal(value.status, 200, 'Device exists');
            assert.equal(value.body.id, deviceIds[0], 'Device ID matches the created device ID');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Set a service property on a virtual device', function (done) {
        droplit.devices.setServiceProperty(deviceIds[0], 'BinarySwitch.switch', {
            value: 'on'
        }).then(value => {
            assert.equal(value.status, 200, 'Service property successfully set on the device');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the property value has changed', function (done) {
        droplit.devices.getServiceProperty(deviceIds[0], 'BinarySwitch.switch', 'false').then(value => {
            assert.equal(value.status, 200, 'Service property exists on device 1');
            assert.equal(value.body.items[0].value, 'on', 'Service property value on the device successfully changed');

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
            assert.equal(value.status, 200, 'Device record successfully updated');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the record has been updated', function (done) {
        droplit.devices.info(deviceIds[0]).then(value => {
            assert.equal(value.status, 200, 'Device 1 exists');
            assert.equal(value.body.meta.$label, 'New Label', 'Device record successfully set');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create and add a second device to the environment', function (done) {
        droplit.devices.create({ environmentId }).then(value => {
            assert.equal(value.status, 201, 'Device successfully created');
            assert.ok(value.body.id, 'Device has an ID');

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
            assert.equal(value.status, 200, 'Service property successfully set on the environment');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the property has been set on both devices', function (done) {
        let devicesChecked = 0;

        deviceIds.forEach((deviceId, index) => {
            droplit.devices.getServiceProperty(deviceId, 'BinarySwitch.switch', 'false').then(value => {
                assert.equal(value.status, 200, 'Service property exists on device' + (index + 1));
                assert.equal(value.body.items[0].value, 'on', 'Service property successfully set on device' + (index + 1));

                devicesChecked++;
            }).catch(error => {
                done(error);
            });
        });

        setTimeout(() => {
            assert.equal(devicesChecked, 2, 'Both devices successfully checked');

            done();
        }, 4000);
    });

    it('Create a third device in the environment', function (done) {
        droplit.devices.create({ environmentId }).then(value => {
            assert.equal(value.status, 201, 'Device successfully created');
            assert.ok(value.body.id, 'Device has an ID');

            deviceIds[2] = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a zone', function (done) {
        droplit.zones.create({ environmentId }).then(value => {
            assert.equal(value.status, 201, 'Zone successfully created');
            assert.ok(value.body.id, 'Zone has an ID');

            zoneId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that the zone exists', function (done) {
        droplit.zones.info(zoneId).then(value => {
            assert.equal(value.status, 200, 'Zone exists');
            assert.equal(value.body.id, zoneId, 'Zone ID matches the created zone ID');

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
                assert.equal(value.status, 201, 'Device ' + (index + 1) + ' successfully added to the zone');

                devicesAdded++;
            }).catch(error => {
                done(error);
            });
        });

        setTimeout(() => {
            assert.equal(devicesAdded, 2, 'Both devices successfully added to the zone');

            done();
        }, 4000);
    });

    it('Verify that both devices and no others are in the zone', function (done) {
        droplit.zones.listItems(zoneId).then(value => {
            assert.equal(value.status, 200, 'Zone exists');
            assert.equal(value.body.items.length, 2, 'Zone contains 2 items');

            deviceIds.forEach((deviceId, index) => {
                if (index === 2) {
                    return;
                }

                assert.equal(value.body.items.some(item => {
                    return item.itemId === deviceId;
                }), true, 'Zone contains device ' + (index + 1));
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
            assert.equal(value.status, 200, 'Service property successfully set on the zone');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify that device 1 and 2 have the property set, but not device 3', function (done) {
        let devicesChecked = 0;

        deviceIds.forEach((deviceId, index) => {
            droplit.devices.getServiceProperty(deviceId, 'BinarySwitch.switch', 'false').then(value => {
                assert.equal(value.status, 200, 'Service property exists');

                if (index === 2) {
                    assert.equal(value.body.items.length, 0, 'Service property not set on device 3');
                } else {
                    assert.equal(value.body.items[0].value, 'on', 'Service property successfully set on device ' + (index + 1));
                }

                devicesChecked++;
            }).catch(error => {
                done(error);
            });
        });

        setTimeout(() => {
            assert.equal(devicesChecked, 3, 'All devices successfully checked');

            done();
        }, 4000);
    });
});

// webhook tests not done yet
describe('Edge Device, Websockets, and Webhooks', function () {
    this.timeout(5000);

    const ecosystemId = droplitEdgeSettings.ecosystemId;
    const webhookUrl = localSettings.webhookUrl;
    let environmentId: string;
    let webhookId: string;
    const deviceIds: string[] = [];

    let callback = function (body: any) {

    };

    after(function (done) {
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

    it('Setup HTTP server', function (done) {
        http.createServer((req, res) => {
            let body = '';
            req.on('data', data => {
                body += data;
            });
            req.on('end', () => {
                callback(body);
            });

            res.writeHead(200);
            res.end();
        }).listen(80, 'localhost', () => {
            done();
        });
    });

    it('Setup webhook', function (done) {
        droplit.webhooks.create(ecosystemId, webhookUrl).then(value => {
            assert.equal(value.status, 201, 'Webhook successfully created');

            webhookId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify webhook is valid', function (done) {
        droplit.webhooks.invokeWebhook(webhookId).then(value => {
            assert.equal(value.status, 200, 'Webhook verified');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Get the environment from the running edge server', function (done) {
        droplit.environments.list(ecosystemId).then(value => {
            assert.notEqual(value.body.items.length, 0, 'There is at least one environment');

            environmentId = value.body.items[0].id;

            droplitClient.subscribe(environmentId);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Identify devices that have been created by running edge server', function (done) {
        droplit.devices.list(environmentId).then(value => {
            assert.notEqual(value.body.items.length, 0, 'Edge server has detected devices');

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
            assert.equal(value.status, 200, 'Service property successfully set');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify the property has been set using refresh = false', function (done) {
        droplit.devices.getServiceProperty(deviceIds[1], 'BinarySwitch.switch', 'false').then(value => {
            assert.equal(value.status, 200, 'Device exists');
            assert.notEqual(value.body.items.length, 0, 'A service property exists on the device');
            assert.equal(value.body.items[0].value, 'on', 'Service property successfully changed');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify the property has been set using refresh = true', function (done) {
        droplit.devices.getServiceProperty(deviceIds[1], 'BinarySwitch.switch', 'true').then(value => {
            assert.equal(value.status, 200, 'Device exists');
            assert.notEqual(value.body.items.length, 0, 'A service property exists on the device');
            assert.equal(value.body.items[0].value, 'on', 'Service property successfully changed');

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
        }).then(value => {
            droplitClient.removeAllListeners('event');

            callback = function (body) {

            };

            assert.equal(value.status, 200, 'Service property successfully set');

            assert.ok(websocketSet, 'Set message recieved from websocket');
            assert.ok(websocketChanged, 'Changed message recieved from websocket');
            assert.ok(webhookSet, 'Set message received from webhook');
            assert.ok(webhookChanged, 'Changed message received from webhook');

            done();
        }).catch(error => {
            done(error);
        });
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

        droplit.devices.callServiceMethod(deviceIds[1], 'Test.doStuff', {}).then(value => {
            droplitClient.removeAllListeners('event');

            callback = function (body) {

            };

            assert.equal(value.status, 200, 'Service method successfully called');

            assert.ok(websocketCall, 'Call message recieved from websocket');
            assert.ok(websocketEvent, 'Event message recieved from websocket');
            assert.ok(webhookCall, 'Call message received from webhook');
            assert.ok(webhookEvent, 'Event message received from webhook');

            done();
        }).catch(error => {
            done(error);
        });
    });
});

describe('History', function () {
    this.timeout(5000);

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
            assert.equal(value.status, 201, 'Ecosystem successfully created');
            assert.ok(value.body.id, 'Ecosystem has an ID');

            ecosystemId = value.body.id;

            done();
        });
    });

    it('Create an environment', function (done) {
        droplit.environments.create({ ecosystemId }).then(value => {
            assert.equal(value.status, 201, 'Environment successfully created');
            assert.ok(value.body.id, 'Environment has an ID');

            environmentId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a virtual device', function (done) {
        droplit.devices.create({ environmentId }).then(value => {
            assert.equal(value.status, 201, 'Device successfully created');
            assert.ok(value.body.id, 'Device has an ID');

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
            assert.equal(value.status, 200, 'Service property successfully changed');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Turn a service property on', function (done) {
        droplit.devices.setServiceProperty(deviceId, 'BinarySwitch.switch', {
            value: 'off'
        }).then(value => {
            assert.equal(value.status, 200, 'Service property successfully changed');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Call a service method on the device', function (done) {
        droplit.devices.callServiceMethod(deviceId, 'BinarySwitch.switchOn', {}).then(value => {
            assert.equal(value.status, 200, 'Service method successfully called');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Verify device history is correct', function (done) {
        droplit.devices.history(deviceId, '').then(value => {
            assert.equal(value.status, 200, 'Device history successfully retrieved');
            assert.equal((<any>value.body).items.length, 3, 'Exactly three events found in history');

            (<any>value.body).items.forEach((item: any, index: number) => {
                switch (index) {
                    case 0:
                        assert.equal(item.type, 'call', 'Call event found in history');
                        break;
                    case 1:
                        assert.equal(item.type, 'set', 'Set event found in history');
                        assert.equal(item.value, 'off', 'Set off event found in history');
                        break;
                    case 2:
                        assert.equal(item.type, 'set', 'Set event found in history');
                        assert.equal(item.value, 'on', 'Set on event found in history');
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
            assert.equal(value.status, 200, 'Environment history successfully retrieved');
            assert.equal((<any>value.body).items.length, 3, 'Exactly three events found in history');

            (<any>value.body).items.forEach((item: any, index: number) => {
                switch (index) {
                    case 0:
                        assert.equal(item.type, 'call', 'Call event found in history');
                        break;
                    case 1:
                        assert.equal(item.type, 'set', 'Set event found in history');
                        assert.equal(item.value, 'off', 'Set off event found in history');
                        break;
                    case 2:
                        assert.equal(item.type, 'set', 'Set event found in history');
                        assert.equal(item.value, 'on', 'Set on event found in history');
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
    this.timeout(5000);

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
            assert.equal(value.status, 201, 'Ecosystem successfully created');
            assert.ok(value.body.id, 'Ecosystem has an ID');

            ecosystemId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create an environment', function (done) {
        droplit.environments.create({ ecosystemId }).then(value => {
            assert.equal(value.status, 201, 'Environment successfully created');
            assert.ok(value.body.id, 'Environment has an ID');

            environmentIds[0] = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create another environment', function (done) {
        droplit.environments.create({ ecosystemId }).then(value => {
            assert.equal(value.status, 201, 'Environment successfully created');
            assert.ok(value.body.id, 'Environment has an ID');

            environmentIds[1] = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a virtual device in the first environment', function (done) {
        droplit.devices.create({ environmentId: environmentIds[0] }).then(value => {
            assert.equal(value.status, 201, 'Device successfully created');
            assert.ok(value.body.id, 'Device has an ID');

            deviceIds[0] = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a virtual device in the second environment', function (done) {
        droplit.devices.create({ environmentId: environmentIds[1] }).then(value => {
            assert.equal(value.status, 201, 'Device successfully created');
            assert.ok(value.body.id, 'Device has an ID');

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
            assert.equal(value.status, 201, 'User successfully created');
            assert.ok(value.body.token, 'User has a token');

            droplit.setAuthorization(value.body.token);

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Fail to list ecosystems', function (done) {
        droplit.ecosystems.list().then(value => {
            assert.equal(value.body, 'Token type not permitted!', 'User does not have access');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('List environments', function (done) {
        droplit.environments.list(ecosystemId).then(value => {
            assert.equal(value.status, 200, 'Environments successfully retrieved');
            assert.equal(value.body.items.length, 1, 'Exactly one environment listed');
            assert.equal(value.body.items[0].id, environmentIds[0], 'Environment ID matches the created environment ID');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('List devices', function (done) {
        droplit.devices.list(environmentIds[0]).then(value => {
            assert.equal(value.status, 200, 'Devices successfully retrieved');
            assert.equal(value.body.items.length, 1, 'Exactly one device listed');
            assert.equal(value.body.items[0].id, deviceIds[0], 'Device ID matches the created device ID');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Fail to list devices in the second environment', function (done) {
        droplit.devices.list(environmentIds[1]).then(value => {
            assert.equal(value.body, 'Token type not permitted!', 'User does not have access');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Set device service property', function (done) {
        droplit.devices.setServiceProperty(deviceIds[0], 'BinarySwitch.switch', {
            value: 'on'
        }).then(value => {
            assert.equal(value.status, 200, 'Service property successfully set');

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
            assert.equal(value.status, 200, 'Device record successfully updated');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a zone', function (done) {
        droplit.zones.create({ environmentId: environmentIds[0] }).then(value => {
            assert.equal(value.status, 201, 'Zone successfully created');
            assert.ok(value.body.id, 'Zone has an ID');

            zoneId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Add the first device to the zone', function (done) {
        droplit.zones.addItem(zoneId, deviceIds[0]).then(value => {
            assert.equal(value.status, 201, 'Device successfully added to the zone');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Fail to add the second device to the zone', function (done) {
        droplit.zones.addItem(zoneId, deviceIds[1]).then(value => {
            assert.equal(value.body, 'Token type not permitted!', 'User does not have access');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Fail to delete the ecosystem', function (done) {
        droplit.ecosystems.deleteEcosystem(ecosystemId).then(value => {
            assert.equal(value.body, 'Token type not permitted!', 'User does not have access');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Delete the first device', function (done) {
        droplit.devices.delete(deviceIds[0]).then(value => {
            assert.equal(value.status, 200, 'Device successfully deleted');

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Delete the first environment', function (done) {
        droplit.environments.deleteEnvironment(environmentIds[0]).then(value => {
            assert.equal(value.status, 200, 'Environment successfully deleted');

            done();
        }).catch(error => {
            done(error);
        });
    });
});

describe('Clients', function () {
    this.timeout(5000);

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
            assert.equal(value.status, 201, 'Ecosystem successfully created');
            assert.ok(value.body.id, 'Ecosystem has an ID');

            ecosystemId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a client', function (done) {
        droplit.clients.create(ecosystemId, 'application').then(value => {
            assert.equal(value.status, 201, 'Client successfully created');

            clientId = value.body.id;

            done();
        });
    });

    it('Verify the client exists', function (done) {
        droplit.clients.info(clientId).then(value => {
            assert.equal(value.status, 200, 'Client exists');

            done();
        });
    });

    it('Update the client info', function (done) {
        droplit.clients.update(clientId, {
            name: 'Test Client'
        }).then(value => {
            assert.equal(value.status, 200, 'Client info successfully updated');

            done();
        });
    });

    it('Verify the client info has been updated', function (done) {
        droplit.clients.info(clientId).then(value => {
            assert.equal(value.status, 200, 'Client exists');
            assert.equal(value.body.name, 'Test Client', 'Client info successfully changed');

            done();
        });
    });

    it('Create a client token', function (done) {
        droplit.tokens.create(clientId).then(value => {
            assert.equal(value.status, 201, 'Token successfully created');

            tokenId = value.body.id;
            token = value.body.token;

            done();
        });
    });

    it('Verify the token exists', function (done) {
        droplit.tokens.info(clientId, tokenId).then(value => {
            assert.equal(value.status, 200, 'Token exists');

            done();
        });
    });

    it('Update the token record', function (done) {
        droplit.tokens.updateToken(clientId, tokenId, {
            description: 'Primary access token'
        }).then(value => {
            assert.equal(value.status, 200, 'Token record successfully updated');

            done();
        });
    });

    it('Verify the token record has been updated', function (done) {
        droplit.tokens.info(clientId, tokenId).then(value => {
            assert.equal(value.status, 200, 'Token exists');
            assert.equal(value.body.description, 'Primary access token', 'Token record successfully changed');

            done();
        });
    });

    it('Regenerate the client token and verify it is different', function (done) {
        droplit.tokens.regenerateToken(clientId, tokenId).then(value => {
            assert.equal(value.status, 201, 'Token successfully regenerated');
            assert.notEqual(value.body.token, token, 'Token successfully changed');

            done();
        });
    });
});

describe('Service classes', function () {
    this.timeout(5000);

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
            assert.equal(value.status, 201, 'Ecosystem successfully created');
            assert.ok(value.body.id, 'Ecosystem has an ID');

            ecosystemId = value.body.id;

            done();
        }).catch(error => {
            done(error);
        });
    });

    it('Create a new service class', function (done) {
        droplit.serviceClasses.create(ecosystemId, 'Test').then(value => {
            assert.equal(value.status, 201, 'Service class successfully created');

            done();
        });
    });

    it('Verify the service class exists', function (done) {
        droplit.serviceClasses.list(ecosystemId).then(value => {
            assert.equal(value.status, 200, 'Service classes successfully listed');
            assert.equal(value.body.items.length, 1, 'Exactly one service class exists');
            assert.equal(value.body.items[0].name, 'Test', 'Service class name matches the created service class name');

            done();
        });
    });
});
