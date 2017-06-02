import { assert } from 'chai';
import { Network } from '../network';
import 'mocha';
const net = Network('test');

describe('Wifi List Parser', function () {
    const testString = '[Stanley Homes Inc][TKIP][PSK]\n[Stanley Homes Inc-guest][OPEN][]\n[Foxconn OEM][OPEN][]\n[droplit][CCMP][PSK]\n[CableWiFi][OPEN][]';
    const naughtyStrings = [];
    const openWrtAuthSuite = ['psk', 'psk-mixed', 'wpa', 'wpa-mixed', ''];
    const items = net.parseWifi(testString);
    console.log(`items ${JSON.stringify(items, null, 2)}`);
    it('should return a array of json objects', function () {
        assert.typeOf(items, 'array');
    });
    it('each element should be an Object', function () {
        items.forEach(element => {
            assert.typeOf(element, 'object');
        });
    });
    it('each object should be a wifi object', function () {
        items.forEach(element => {
            assert.match(element.SSID, /./);
            assert.match(element.CIPHER, /[A-Z]/);
            assert.include(openWrtAuthSuite, element.AUTH_SUITE.toLowerCase());
        });
    });
});
describe('Scan Wifi Command', function () {
    it('should return a promise', () => {
        assert.typeOf(net.scanWifi(), 'promise');
    });
    it('should resolve with a string of wifi', done => {
        return net.scanWifi().then(() => {
            assert.ok(true);
            done;
        }).catch(() => {
            assert.ok(false);
            done;
        });
    });
});
describe('createWap', () => {
    const SSID = 'hub_cadb';
    it('should generate a command like createWap [SSID]', done => {
        return net.createWap(SSID).then( () => {
            assert.ok(true);
            done;
        }).catch( () => {
            assert.isOk(false);
            done;
        });
    });
});
describe('connect hub to wifi', () => {
    const command = '';
    it('should generate a command like connectWiFi [SSID] [AUTH_SUITE] [PASSCODE]', done => {
        return net.connectWifi(command).then( () => {
            assert.ok(true);
            done;
        }).catch( () => {
            assert.isOk(false);
            done;
        });
    });
});
