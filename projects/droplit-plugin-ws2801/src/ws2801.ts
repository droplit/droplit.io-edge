import * as droplit from 'droplit-plugin';

export interface PropertyMap { [service: string]: { [member: string]: [{ index: number, value: any }] }; }

export interface ValueIndex {
    value: any;
    index: number;
}

export class Ws2801 extends droplit.DroplitPlugin {
    private numLeds: number;
    private strip: PiStrip;
    services: any;
    constructor(settings: any) {
        super();
        this.services = {
            BinarySwitch: {
                get_switch: this.getSwitch,
                set_switch: this.setSwitch,
                switchOff: this.switchOff,
                switchOn: this.switchOn
            },
            DimmableSwitch: {
                get_brightness: this.getDSBrightness,
                set_brightness: this.setDSBrightness,
                stepDown: this.stepDown,
                stepUp: this.stepUp
            },
            LightColor: {
                get_brightness: this.getMclBrightness,
                get_hue: this.getHue,
                get_saturation: this.getSaturation,
                set_brightness: this.setMclBrightness,
                set_hue: this.setHue,
                set_saturation: this.setSaturation
            }
        };
        this.init();
    }

    private init() {
        if (this.numLeds) {
            this.strip = new PiStrip(this.numLeds, 'rpi-ws2801');
            this.strip.initialize(() => {
                this.strip.library.connect(this.numLeds);
            });
            this.strip.configureSet((red, green, blue, index?) => {
                index || index === 0 ? sendBuffer.apply(this) : this.strip.library.fill(red, blue, green);
                function sendBuffer() {
                    const buf = new Buffer(this.strip.pixels.length * 3);
                    let pixelCounter = 0;
                    for (let ii = 0; ii < this.strip.pixels.length * 3; ii = ii + 3) {
                        buf[ii] = this.strip.pixels[pixelCounter].red;
                        buf[ii + 1] = this.strip.pixels[pixelCounter].blue;
                        buf[ii + 2] = this.strip.pixels[pixelCounter].green;
                        pixelCounter++;
                    }
                    this.strip.library.sendRgbBuffer(buf);
                }
            });
            this.onDeviceInfo(
                {
                    localId: '.',
                    services: ['BinarySwitch', 'DimmableSwitch', 'LightColor']
                }
            );
        }
    }

    private reload() {
        this.init();
    }

    public setSetting(setting: any) {
        switch (setting.key) {
            case 'numLeds':
                this.numLeds = setting.value;
                this.reload();
                break;
            default:
                console.log('Unknown setting');
        }
    }

    discover() {

    }

    dropDevice(localId: string) {
        return false;
    }

    // BinarySwitch Implementation
    getSwitch(localId: string, callback: any, index: number) {
        callback(this.strip.pixels[index].red === 0 && this.strip.pixels[index].green === 0 && this.strip.pixels[index].blue === 0 ? 'off' : 'on');
    }

    setSwitch(localId: string, valueIndexes: ValueIndex[], callback: any) {
        this.switchOn(localId, valueIndexes.filter(valueIndex => {
            return valueIndex.value === 'on';
        }), callback);
        this.switchOff(localId, valueIndexes.filter(valueIndex => {
            return valueIndex.value === 'off';
        }), callback);
    }

    switchOff(localId: string, valueIndexes: ValueIndex[], callback: any) {
        valueIndexes.forEach(valueIndex => {
            this.strip.pixels[valueIndex.index] = { red: 0, green: 0, blue: 0 };
        });
        this.strip.update(this.strip.pixels);
        this.onPropertiesChanged(valueIndexes.map(valueIndex => {
            return {
                localId: '.',
                service: 'BinarySwitch',
                member: 'switch',
                index: valueIndex.index.toString(),
                value: valueIndex.value || 'off'
            };
        }));
    }

    switchOn(localId: string, valueIndexes: ValueIndex[], callback: any) {
        valueIndexes.forEach(valueIndex => {
            this.strip.pixels[valueIndex.index] = { red: 255, green: 255, blue: 255 };
        });
        this.strip.update(this.strip.pixels);
        this.onPropertiesChanged(valueIndexes.map(valueIndex => {
            return {
                localId: '.',
                service: 'BinarySwitch',
                member: 'switch',
                index: valueIndex.index.toString(),
                value: valueIndex.value
            };
        }));
    }

    // DimmableSwitch Implementation
    getDSBrightness(localId: string, callback: any, index: number) {
        callback();
    }

    setDSBrightness(localId: string, value: number, index: number) {
        return true;
    }

    stepDown(localId: string, value: number) {
        return true;
    }

    stepUp(localId: string, value: any) {
        return true;
    }

    getMclBrightness(localId: string, value: any, callback: any, index: number) {
    }

    getHue(localId: string, value: any, callback: any, index: number) {
    }

    getSaturation(localId: string, value: any, callback: any, index: number) {
    }

    getTemperature(localId: string, value: any, callback: any, index: number) {
    }

    getTempMin(localId: string, value: any, callback: any, index: number) {

    }

    getTempMsx(localId: string, value: any, callback: any, index: number) {

    }

    // private hue: number;
    // private saturation: number;
    // private value: number;

    setHue(localId: string, value: any, callback: any, index: number) {
        // this.hue = Math.min(Math.max(normalize(value, 0, 0xffff, 254), 0), 254);
        // const pixels = new Array(this.strip.pixels.length);
        // const color = hsvToRgb(this.hue, this.saturation, this.value);
        // for (let i = 0; i < pixels.length; i++) {
        //     pixels[i] = this.rgb2Int(color.red, color.green, color.blue);
        // }
        // this.strip.library.render(pixels);
    }

    setMclBrightness(localId: string, value: any, callback: any, index: number) {
        // this.value = Math.min(Math.max(normalize(value, 0, 0xffff, 254), 0), 254);
        // const pixels = new Array(this.strip.pixels.length);
        // const color = hsvToRgb(this.hue, this.saturation, this.value);
        // for (let i = 0; i < pixels.length; i++) {
        //     pixels[i] = this.rgb2Int(color.red, color.green, color.blue);
        // }
        // this.strip.library.render(pixels);
    }

    setSaturation(localId: string, value: any, callback: any, index: number) {
        // this.saturation = Math.min(Math.max(normalize(value, 0, 0xffff, 254), 0), 254);
        // const pixels = new Array(this.strip.pixels.length);
        // const color = hsvToRgb(this.hue, this.saturation, this.value);
        // for (let i = 0; i < pixels.length; i++) {
        //     pixels[i] = this.rgb2Int(color.red, color.green, color.blue);
        // }
        // this.strip.library.render(pixels);
    }

    setProperties(properties: droplit.DeviceServiceMember[]): boolean[] {
        // Check if everything is supported first
        const areSupported = properties.map(property => {
            const methodImplementation = this.getServiceMember(property.service, `set_${property.member}`);
            if (methodImplementation) {
                return true;
            } else {
                return false;
            }
        });
        if (areSupported.every(prop => prop === true)) {
            const mappedProperties: PropertyMap = properties.reduce((finalMap: PropertyMap, property: droplit.DeviceServiceMember) => {
                if (!finalMap[property.service]) {
                    finalMap[property.service] = {};
                }
                if (!finalMap[property.service][property.member]) {
                    finalMap[property.service][property.member] = [{ index: Number(property.index), value: property.value }];
                } else {
                    finalMap[property.service][property.member].push({ index: Number(property.index), value: property.value });
                }
                return finalMap;
            }, {});
            Object.keys(mappedProperties).forEach((service: string) => {
                Object.keys(mappedProperties[service]).forEach((member: string) => {
                    this.getServiceMember(service, `set_${member}`).apply(this, [ '.', mappedProperties[service][member] ]);
                });
            });
        }
        return areSupported;
    }
    callMethod(method: droplit.DeviceServiceMember): boolean {
        const params = [method.localId, method.value, undefined, method.index];
        const methodImplementation = this.getServiceMember(method.service, method.member);

        if (methodImplementation) {
            const isSupported = methodImplementation.apply(this, params);
            return this.getMethodStatus(isSupported);
        }

        // method not implemented
        return false;
    }

    /**
     * callMethods - Call multiple service methods
     *
     * @param {DeviceServiceMember[]} methods - array of methods to call
     * @returns {boolean[]} array of booleans indicating if method is supported
     */
    callMethods(methods: droplit.DeviceServiceMember[]): boolean[] {
        // Check if everything is supported first
        const areSupported = methods.map(method => {
            const methodImplementation = this.getServiceMember(method.service, method.member);
            if (methodImplementation) {
                return true;
            } else {
                return false;
            }
        });
        if (areSupported.every(method => method === true)) {
            const mappedMethods: PropertyMap = methods.reduce((finalMap: PropertyMap, method: droplit.DeviceServiceMember) => {
                if (!finalMap[method.service]) {
                    finalMap[method.service] = {};
                }
                if (!finalMap[method.service][method.member]) {
                    finalMap[method.service][method.member] = [{ index: Number(method.index), value: method.value }];
                } else {
                    finalMap[method.service][method.member].push({ index: Number(method.index), value: method.value });
                }
                return finalMap;
            }, {});
            Object.keys(mappedMethods).forEach((service: string) => {
                Object.keys(mappedMethods[service]).forEach((member: string) => {
                    this.getServiceMember(service, member).apply(this, [ '.', mappedMethods[service][member] ]);
                });
            });
        }
        return areSupported;
    }
}

// function hsvToRgb(hue: number, saturation: number, value: number) {
//     const c = value * saturation;
//     const h = hue / 60;
//     const x = c * (1 - Math.abs((h % 2) - 1));
//     const m = value - c;

//     let tmp;
//     if (h >= 0 && h < 1)
//         tmp = { r: c, g: x, b: 0 };
//     else if (h >= 1 && h < 2)
//         tmp = { r: x, g: c, b: 0 };
//     else if (h >= 2 && h < 3)
//         tmp = { r: 0, g: c, b: x };
//     else if (h >= 3 && h < 4)
//         tmp = { r: 0, g: x, b: c };
//     else if (h >= 4 && h < 5)
//         tmp = { r: x, g: 0, b: c };
//     else if (h >= 5 && h <= 6)
//         tmp = { r: c, g: 0, b: x };
//     else
//         tmp = { r: 0, g: 0, b: 0 };

//     return {
//         red: parseInt(255 * (tmp.r + m)),
//         green: parseInt(255 * (tmp.g + m)),
//         blue: parseInt(255 * (tmp.b + m))
//     };
// }

// function rgbToHsv(red: number, green: number, blue: number) {
//     const b = blue / 255;
//     const g = green / 255;
//     const r = red / 255;
//     const max = Math.max(r, g, b);
//     const min = Math.min(r, g, b);
//     const c = max - min;

//     let tmp = 0;
//     if (c === 0)
//         tmp = 0;
//     else if (max === r)
//         tmp = ((g - b) / c) % 6;
//     else if (max === g)
//         tmp = ((b - r) / c) + 2;
//     else
//         tmp = ((r - g) / c) + 4;

//     const hue = tmp * 60;
//     const value = max;
//     const sat = c === 0 ? 0 : c / value;

//     return { hue, sat, value };
// }

// function normalize(value: number, min: number, max: number, mult: number) {
//     mult = mult || 100;
//     return Math.round(((value - min) / (max - min)) * mult);
// }

enum Direction {
    forward,
    backward
}

interface Colors {
    red: number;
    green: number;
    blue: number;
}

class PiStrip {
    length: number;
    pixels: Colors[] = [{ red: 0, green: 0, blue: 0 }];
    intervals: any[] = [];
    library: any;
    set: (red: number, green: number, blue: number, index?: number) => void;
    send: () => void | undefined;
    preferSet = true;

    /**
     * Make an RGB LED Strip
     * @param {string} theId Id of strip
     * @param {string} theName Name of
     * @param {number} theLength Length of strip
     * @param {*} theLibrary Library used to control strip
     * @param {Strip} theType Type of strip
     * @param {callback} setter How to set the state of the strip
     */
    constructor(length: number, library: string) {
        this.length = length;
        this.library = require(library);
        for (let ii = 0; ii < this.length; ii++) {
            this.pixels[ii] = {
                red: 0,
                green: 0,
                blue: 0
            };
        }
    }

    stopRoutine() {
        if (this.intervals) {
            clearInterval(this.intervals.pop());
        }
    }

    clearRoutines() {
        if (this.intervals) {
            for (let interval of this.intervals) {
                interval = null;
                clearInterval(this.intervals.pop());
            }
        }
    }

    initialize(initializer?: () => void) {
        if (initializer === undefined) {
            this.initialize();
        } else {
            this.initialize = initializer;
            this.initialize();
        }
    }

    configureSet(setter: (red: number, green: number, blue: number, index?: number) => void) {
        this.set = setter;
    }

    turnOn() {
        this.fill(255, 255, 255);
    }

    turnOff() {
        this.fill(0, 0, 0);
    }

    /**
     * Set the whole LED strip to an RGB value
     * @param {number} red Red LED brightness from 0 to 255
     * @param {number} green Green LED brightness from 0 to 255
     * @param {number} blue Blue LED brightness from 0 to 255
     * @param {boolean} [keepInterval = false] Do not override the current running animation
     */
    fill(red: number = 255, green: number = 255, blue: number = 255, keepInterval?: boolean) {
        for (const pixel of this.pixels) {
            pixel.red = red;
            pixel.green = green;
            pixel.blue = blue;
        }
        this.preferSet ? this.set(red, green, blue) : this.send();
        if (!keepInterval) {
            this.clearRoutines();
        }
    }

    update(colors: Colors[] = [], keepInterval?: boolean) {
        for (let ii = 0; ii < Math.min(this.length, colors.length); ii++) {
            this.pixels[ii] = colors[ii];
        }
        this.set(this.pixels[0].red, this.pixels[0].green, this.pixels[0].blue, 0);
        if (!keepInterval) {
            this.clearRoutines();
        }
    }

    /**
     * Shift and fade between RGB
     * @param {number} [min = 0] Minimum brightness
     * @param {number} [max = 255] Maximum brightness
     * @param {number} [time = 5] Time between state changes
     */
    pulseRainbow(min: number = 0, max: number = 255, time: number = 5) {
        this.turnOff();
        const rgbColor: number[] = [max, min, min];

        let decreasingColor = 0;
        let ii = min;
        let increasingColor = decreasingColor + 1;
        this.intervals.push(setInterval(() => {
            if (ii === max) {
                if (decreasingColor < 3) {
                    decreasingColor++;
                } else {
                    decreasingColor = 0;
                }
                increasingColor = decreasingColor === 2 ? 0 : decreasingColor + 1;
                ii = min;
            } else {
                rgbColor[decreasingColor] -= 1;
                rgbColor[increasingColor] += 1;
                this.fill(rgbColor[0], rgbColor[1], rgbColor[2], true);
                ii++;
            }
        }, time));
    }

    /**
     *
     * @param colors
     * @param time
     * @param random
     */
    fade(colors: Colors[], time: number, random?: boolean) {
        if (colors.length > 1) {
            this.multiFade(colors, time, random);
        } else {
            this.fadeTo(colors[0].red, colors[0].green, colors[0].blue, time);
        }
    }

    /**
     * Fade to a certain color
     * @param {number} [red = 255] Red LED brightness from 0 to 255
     * @param {number} [green = 255] Green LED brightness from 0 to 255
     * @param {number} [blue = 255] Blue LED brightness from 0 to 255
     * @param {number} [time = 5] Time between animation frames
     * @param {callback} done Function to call when animation is complete
     */
    fadeTo(red: number = 255, green: number = 255, blue: number = 255, time: number = 5, done: () => void = () => { }) {
        let cRed = this.pixels[0].red;
        let cGreen = this.pixels[0].green;
        let cBlue = this.pixels[0].blue;
        const rInc = red > cRed ? true : false;
        const gInc = green > cGreen ? true : false;
        const bInc = blue > cBlue ? true : false;
        const maxBrightness = Math.max(red, green, blue, cRed, cGreen, cBlue);
        const rStep = Math.abs(red - cRed) / maxBrightness;
        const gStep = Math.abs(green - cGreen) / maxBrightness;
        const bStep = Math.abs(blue - cBlue) / maxBrightness;

        this.intervals.push(setInterval(() => {
            let doneFading = true;
            if (rInc && cRed < red && cRed < 255) {
                cRed = cRed + rStep;
                doneFading = doneFading && false;
            } else if (!rInc && cRed > red && cRed > 0) {
                cRed = cRed - rStep;
                doneFading = doneFading && false;
            } else {
                doneFading = doneFading && true;
            }
            if (gInc && cGreen < green && cGreen < 255) {
                cGreen = cGreen + gStep;
                doneFading = doneFading && false;
            } else if (!gInc && cGreen > green && cGreen > 0) {
                cGreen = cGreen - gStep;
                doneFading = doneFading && false;
            } else {
                doneFading = doneFading && true;
            }
            if (bInc && cBlue < blue && cBlue < 255) {
                cBlue = cBlue + bStep;
                doneFading = doneFading && false;
            } else if (!bInc && cBlue > blue && cBlue > 0) {
                cBlue = cBlue - bStep;
                doneFading = doneFading && false;
            } else {
                doneFading = doneFading && true;
            }
            if (doneFading) {
                this.stopRoutine();
                done();
            } else {
                this.fill(cRed, cGreen, cBlue, true);
            }
        }, time));
    }

    /**
     * Fade through multiple colors
     * @param {Object[]} colors - Colors to fade through
     * @param {number} colors[].red - Red LED brightness from 0 to 255
     * @param {number} colors[].green - Green LED brightness from 0 to 255
     * @param {number} colors[].blue - Blue LED brightness from 0 to 255
     * @param {boolean} random - Fade through colors randomly instead of sequentially
     */
    multiFade(colors: Colors[] = [{ red: 255, green: 255, blue: 255 }, { red: 0, green: 0, blue: 0 }], time: number = 5, random?: boolean) {
        this.clearRoutines();
        let canContinue = true;
        let selector = -1;

        this.intervals.push(setInterval(() => {
            if (canContinue) {
                if (random) {
                    selector = Math.floor(Math.random() * colors.length);
                } else {
                    if (selector === colors.length - 1) {
                        selector = 0;
                    } else {
                        selector++;
                    }
                }
                const pixel = colors[selector];
                this.fadeTo(pixel.red, pixel.green, pixel.blue, time, () => {
                    canContinue = true;
                });
            }
            canContinue = false;
        }));
    }

    pulse(red: number = 255, green: number = 255, blue: number = 255, time: number = 5, min: number = 0) {
        this.multiFade([{ red, green, blue }, { red: min, green: min, blue: min }], time);
    }

    pixel(red: number = 255, green: number = 255, blue: number = 255, index: number = 0, keepInterval?: boolean) {
        this.pixels[index] = { red, green, blue };
        this.set(red, green, blue, index);
        if (!keepInterval) {
            this.clearRoutines();
        }
    }

    wipe(red: number = 255, green: number = 255, blue: number = 255, time: number = 5, direction: Direction = Direction.forward, done: () => void = () => { }) {
        this.clearRoutines();
        let ii = direction === Direction.forward ? 0 : this.length - 1;
        this.intervals.push(setInterval(() => {
            if ((ii === this.length && direction === Direction.forward) || (ii === 0 && direction === Direction.backward)) {
                this.stopRoutine();
                done();
            } else {
                this.pixel(red, green, blue, ii, true);
                direction === Direction.forward ? ii++ : ii--;
            }
        }, time));
    }

    carnival(foreground: { red: number, green: number, blue: number, radius: number } = { red: 255, green: 255, blue: 255, radius: 2 }, background: { red: number, green: number, blue: number } = { red: 255, green: 255, blue: 255 }, time: number = 5) {
        this.fill(background.red, background.green, background.blue);
        let ii = 0;

        this.intervals.push(setInterval(() => {
            if (ii < this.length) {
                ii++;
            } else if (ii >= this.length && ii < this.length * 2) {
                ii++;
            } else {
                ii = 0;
            }

            // function setRadius() {
            //     for (let jj = 0; jj > )
            // }

        }, time));
    }
}