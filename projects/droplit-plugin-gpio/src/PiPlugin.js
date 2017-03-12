'use strict';

const droplit = require('droplit-plugin');
const Gpio = require('onoff').Gpio;
const GPIOpins = [
    new Gpio(2, 'in'),
    new Gpio(3, 'in'),
    new Gpio(4, 'in'),
    new Gpio(14, 'in'),
    new Gpio(15, 'in'),
    new Gpio(17, 'in'),
    new Gpio(18, 'in'),
    new Gpio(27, 'in'),
    new Gpio(21, 'in'),
    new Gpio(22, 'in'),
    new Gpio(23, 'in'),
    new Gpio(24, 'in'),
    new Gpio(10, 'in'),
    new Gpio(9, 'in'),
    new Gpio(25, 'in'),
    new Gpio(11, 'in'),
    new Gpio(8, 'in'),
    new Gpio(7, 'in')];
const pinLocalId = '.';
class PiPlugin extends droplit.DroplitPlugin {

    constructor() {
        super();

        // virtual device states
        this.devices = {};

        /* eslint-disable camelcase */
        this.services = {
            BinarySwitch: {
                get_switch: this.getSwitch,
                set_switch: this.setSwitch,
                switchOff: this.switchOff,
                switchOn: this.switchOn
            },
            GPIO: {
                get_direction: this.getDirection,
                set_direction: this.setDirection,
                directionIn: this.directionIn,
                directionOut: this.directionOut
            }
        };
        /* es-lint-enable camelcase */
    }

	/**
	 * Create each pin type as it's own device
	 */
    discover() {
        var pins = new Array(GPIOpins.length);
        for (var index = 0; index < GPIOpins.length; index++) {
            pins[index] = { 'BinarySwitch.switch': 'off' };
        }

        if (!this.devices[pinLocalId]) {
            this.devices[pinLocalId] = pins;
			/*
			this.onDeviceInfo({
				localId: pinLocalId,
				address: 'device.0',
				deviceMeta: {
					customName: 'GPIO pins',
					location: 'RaspberryPi'
				},
				services: ['BinarySwitch', 'GPIO'],
				promotedMembers: {
					switch: 'BinarySwitch.switch'
				}
			});*/

            for (var index = 0; index < GPIOpins.length; index++) {
                GPIOpins[index].watch(function (err, value) { this.stateChanged(err, value, index); });
                this.stateChanged(false, 'off', index);
            }
        }

        this.onDiscoverComplete();
    }

    dropDevice(localId) {
        delete this.devices[pinLocalId];
        return true;
    }

    // BinarySwitch Implementation
    getSwitch(localId, callback, index) {
        // device does not exist
        if (!this.devices[pinLocalId][index]) {
            callback(undefined);
            return true;
        }

        callback(this.devices[pinLocalId][index]['BinarySwitch.switch']);

        return true;
    }

    setSwitch(localId, value, index) {
        if (typeof value === 'string')
            value = value.toLowerCase();

        // check if values are valid
        if (value === 'on' || value === 1)
            value = 1;
        else
            value = 0;

        // setting device property
        if (this.devices[pinLocalId][index]) {
            if (GPIOpins[index].direction === 'in') {
                this.logErr("Can't set pin while in 'input' mode");
                return true;
            }
            GPIOpins[index].write(value, this.logErr);
        } else {
            logErr(`Device ${localId}, index ${index}, not found!`);
            return true;
        }
        this.devices[pinLocalId][index]['BinarySwitch.switch'] = value;

        this.stateChanged(false, value, index);

        return true;
    }

    switchOff(localId, value, callback, index) {
        return this.setSwitch(localId, 'off', index);
    }

    switchOn(localId, value, callback, index) {
        return this.setSwitch(localId, 'on', index);
    }

    getDirection(localId, callback, index) {
        if (!GPIOpins[index])
            callback(undefined);

        callback(GPIOpins[index].direction());

        return true;
    }

    setDirection(localId, value, index) {
        if (typeof value === 'string')
            value = value.toLowerCase();

        if (!GPIOpins[index])
            this.logErr(`Index ${index} out of bounds.`);

        if (value === 'in') {
            if (GPIOpins[index].direction() !== 'in') GPIOpins[index].watch(function (err, value) { this.stateChanged(err, value, index); });
        } else if (value === 'out' || value === 'high' || value === 'low') {
            GPIOpins[index].unwatch();
        } else {  // bad input
            this.logErr(`Direction ${value} not supported.`);
        }

        GPIOpins[index].setDirection(value);
        this.stateChanged(false, GPIOpins[index].readSync(), index);
        return true;
    }

    directionIn(localId, value, callback, index) {
        return this.setDirection(localId, 'in', index);
    }

    directionOut(localId, value, callback, index) {
        return this.setDirection(localId, 'out', index);
    }

    stateChanged(err, value, index) {
        if (err) {
            this.logErr(err);
        } else {
            if (value === 1)
                value = 'on';
            else
                value = 'off';

            console.log(`Pin ${index} set to ${value}.`);
            this.onPropertiesChanged([
                { localId: pinLocalId, index, member: 'switch', service: 'BinarySwitch', value },
                { localId: pinLocalId, index, member: 'direction', service: 'GPIO', value: GPIOpins[index].direction() }
            ]);
        }
    }

    logErr(error, callback) {
        if (error && console) {
            console.log(error);
        }

        if (typeof callback === 'function')
            callback(undefined);
    }

    async(func, a, b, c, d, e) {
        setImmediate(() => { // simulate async
            func(a, b, c, d, e);
        });
    }
}

module.exports = PiPlugin;