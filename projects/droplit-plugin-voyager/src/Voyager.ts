import * as droplit from '../../droplit-plugin';
import { Discoverer } from './Discoverer';
import { VoyagerClient } from './VoyagerClient';

export interface Response {
    status: number;
    body?: any;
}

export class VoyagerPlugin extends droplit.DroplitPlugin {

    devices: any;
    discoverer: any;
    services: any;
    changes: any;

    constructor() {
        super();

        this.devices = {};
        this.discoverer = new Discoverer();

        this.discoverer.on('discovered', onDiscovered.bind(this));
        this.discoverer.on('ipchange', onDiscoverIPChange.bind(this));

        this.services = {
            Thermostat: {
                get_mode: this.getMode,
                set_mode: this.setMode,
                get_fan: this.getFan,
                set_fan: this.setFan,
                get_coolTemperature: this.getCoolTemperature,
                set_coolTemperature: this.setCoolTemperature,
                get_heatTemperature: this.getHeatTemperature,
                set_heatTemperature: this.setHeatTemperature,
                get_state: this.getState,
                get_away: this.getAway,
                set_away: this.setAway
                // get_airFilter: this.getAirFilter
            },
            Temperature: {
                get_temperature: this.getTemperature,
                get_unitMode: this.getUnitMode,
                set_unitMode: this.setUnitMode
            }
            // Humidity: {
            //     get_humidity: this.getHumidity
            // }
        };

        function onDiscovered(device: any) {
            if (this.devices[device.identifier]) {
                return;
            }
            // this.devices.address = device.location.href;
            const client = new VoyagerClient(device);
            client.on('propertiesChanged', (data: any) => {
                this.onPropertiesChanged(data);
            });
            this.devices[device.identifier] = client;
            device.deviceMeta = {};
            const onInfo = (data: any) => {
                device.deviceMeta.modelName = data.body.model;
                device.deviceMeta.firmwareVersion = data.body.firmware;
                device.deviceMeta.manufacturer = 'Venstar';

                this.onDeviceInfo(
                    {
                        localId: device.identifier,
                        services: ['Thermostat', 'Temperature'],
                        address: device.address,
                        deviceMeta: device.deviceMeta
                    }
                );
            };
            client.info(onInfo);
        }

        function onDiscoverIPChange(data: any) {
            const identifier = data.identifier;
            const address = data.ip.host;
            if (!this.devices[identifier]) {
                return;
            }

            this.devices[identifier].device.address = `http://${address}/`;
            this.onDeviceInfo({
                address,
                localId: identifier
            });
        }
    }
    public discover() {
        this.discoverer.discover();
    }

    dropDevice(localId: string) {
        if (!(localId in this.devices)) {
            return false;
        }
        const identifier = this.devices.identifier;
        clearInterval(this.devices[identifier].device.interval);
        delete this.devices.identifier;
        this.discoverer.undiscover(identifier);
    }

    getMode(localId: string, callback: any) {
        if (this.devices[localId]) {
            // console.log('this.device', this.devices);
            this.devices[localId].getMode(callback);
        }
    }
    setMode(localId: string, value: string) {
        if (this.devices[localId]) {
            this.devices[localId].setMode(value);
        }
    }
    getFan(localId: string, callback: any) {
        if (this.devices[localId]) {
            this.devices[localId].getFan(callback);
        }
    }
    setFan(localId: string, value: string) {
        if (this.devices[localId]) {
            this.devices[localId].setFan(value);
        }
    }
    getCoolTemperature(localId: string, callback: any) {
        if (this.devices[localId]) {
            this.devices[localId].getCool(callback);
        }
    }
    setCoolTemperature(localId: string, value: any) {
        if (this.devices[localId]) {
            if (typeof value === 'number') {
                const temperature = value;
                this.devices[localId].setCool(temperature);
            } else if (typeof value === 'string') {
                const unitMatch = value.match(/(^(?:[0-9]{1,3})) ?(?:(?:([fF])(?:arenheit)?)|(?:([cC])(?:elsius)?))$/);
                const tempMatch = value.match(/(^(?:[0-9]{1,3}))$/);
                if (unitMatch) {
                    const temperature = Number(unitMatch[1]);
                    const units: string = unitMatch[2] ? 'fahrenheit' : 'celsius';
                    this.devices[localId].setCool(temperature, units);
                } else if (tempMatch) {
                    const temperature = Number(tempMatch[1]);
                    this.devices[localId].setCool(temperature);
                }
            } else if (typeof value === 'object') {
                const unit = value.unit;
                const unitMatch = unit.match(/(?:(?:([fF])(?:arenheit)?)|(?:([cC])(?:elsius)?))$/);
                if (unitMatch) {
                    const units: string = unitMatch[1] ? 'fahrenheit' : 'celsius';
                    this.devices[localId].setCool(value.value, units);
                } else {
                    this.devices[localId].setCool(value.value);
                }
            }
        }
    }
    getHeatTemperature(localId: string, callback: any) {
        if (this.devices[localId]) {
            this.devices[localId].getHeat(callback);
        }
    }
    setHeatTemperature(localId: string, value: any) {
        if (this.devices[localId]) {
            if (typeof value === 'number') {
                const temperature = value;
                this.devices[localId].setHeat(temperature);
            } else if (typeof value === 'string') {
                const unitMatch = value.match(/(^(?:[0-9]{1,3})) ?(?:(?:([fF])(?:arenheit)?)|(?:([cC])(?:elsius)?))$/);
                const tempMatch = value.match(/(^(?:[0-9]{1,3}))$/);
                if (unitMatch) {
                    const temperature = Number(unitMatch[1]);
                    const units: string = unitMatch[2] ? 'fahrenheit' : 'celsius';
                    this.devices[localId].setHeat(temperature, units);
                } else if (tempMatch) {
                    const temperature = Number(tempMatch[1]);
                    this.devices[localId].setHeat(temperature);
                }
            } else if (typeof value === 'object') {
                const unit = value.unit;
                const unitMatch = unit.match(/(?:(?:([fF])(?:arenheit)?)|(?:([cC])(?:elsius)?))$/);
                if (unitMatch) {
                    const units: string = unitMatch[1] ? 'fahrenheit' : 'celsius';
                    this.devices[localId].setHeat(value.value, units);
                } else {
                    this.devices[localId].setHeat(value.value);
                }
            }
        }
    }
    getCooling(localId: string, callback: any) {
        if (this.devices[localId]) {
            this.devices[localId].getCooling(callback);
        }
    }
    getHeating(localId: string, callback: any) {
        if (this.devices[localId]) {
            this.devices[localId].getHeating(callback);
        }
    }
    getState(localId: string, callback: any) {
        if (this.devices[localId]) {
            this.devices[localId].getState(callback);
        }
    }
    getTemperature(localId: string, callback: any) {
        if (this.devices[localId]) {
            this.devices[localId].getTemperature(callback);
        }
    }
    getUnitMode(localId: string, callback: any) {
        if (this.devices[localId]) {
            this.devices[localId].getUnits(callback);
        }
    }
    setUnitMode(localId: string, value: number) {
        if (this.devices[localId]) {
            this.devices[localId].setUnits(value);
        }
    }
    getAway(localId: string, callback: any) {
        if (this.devices[localId]) {
            this.devices[localId].getAway(callback);
        }
    }
    setAway(localId: string, value: boolean) {
        if (this.devices[localId]) {
            this.devices[localId].setAway(value);
        }
    }
}
