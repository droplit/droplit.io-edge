import * as droplit from 'droplit-plugin';
export class NeopixelPlugin extends droplit.DroplitPlugin {
    private numLeds: number;
    private strip: PiStrip;
    services: any;
    constructor() {
        super();
        this.services = {
            BinarySwitch: {
                get_switch: this.getSwitch,
                set_switch: this.setSwitch,
                switchOff: this.switchOff,
                switchOn: this.switchOn
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
            this.strip = new PiStrip(this.numLeds, 'rpi-ws281x-native');
            this.strip.initialize(() => {
                this.strip.library.init(this.numLeds);
            });
            this.strip.configureSet((red, green, blue, index?) => {
                const pixels = [];
                if (index === undefined) {
                    for (let i = 0; i < pixels.length; i++) {
                        pixels[i] = this.rgb2Int(red, green, blue);
                    }
                } else {
                    for (let i = 0; i < pixels.length; i++) {
                        pixels[i] = (i === index) ?
                            this.rgb2Int(red, green, blue) :
                            this.rgb2Int(this.strip.pixels[i].red, this.strip.pixels[i].green, this.strip.pixels[i].blue);
                    }
                }
                this.strip.library.render(pixels);
            });
        }
    }

    private rgb2Int(r: number, g: number, b: number) {
        return ((r & 0xFF) << 16) + ((g & 0xFF) << 8) + (b & 0xFF);
    }

    private reload() {
        this.init();
    }

    public setSetting(setting: any) {
        switch (setting.key) {
            case 'numLeds':
                this.numLeds = setting.value;
                break;
            default:
                console.log('Unknown setting');
        }
        this.reload();
    }

    discover() {

    }

    dropDevice(localId: string) {
        return false;
    }
    // BinarySwitch Implementation
    getSwitch(localId: string, callback: any) {

    }

    setSwitch(localId: string, value: any, index: string) {

    }

    switchOff(localId: string, value: any, callback: any, index: number) {
        const pixels = new Array(this.strip.pixels.length);
        for (let i = 0; i < pixels.length; i++) {
            if (i === index) {
                pixels[i] = this.rgb2Int(0, 0, 0);
                this.strip.pixels[i] = { red: 0, green: 0, blue: 0 };
            } else {
                pixels[i] = this.rgb2Int(this.strip.pixels[i].red, this.strip.pixels[i].green, this.strip.pixels[i].blue);
            }
        }
        this.strip.library.render(pixels);
        return true;
    }

    switchOn(localId: string, value: any, callback: any, index: number) {
        const pixels = new Array(this.strip.pixels.length);
        for (let i = 0; i < pixels.length; i++) {
            if (i === index) {
                pixels[i] = this.rgb2Int(255, 255, 255);
                this.strip.pixels[i] = { red: 255, green: 255, blue: 255 };
            } else {
                pixels[i] = this.rgb2Int(this.strip.pixels[i].red, this.strip.pixels[i].green, this.strip.pixels[i].blue);
            }
        }
        this.strip.library.render(pixels);
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

    private hue: number;
    private saturation: number;
    private value: number;

    setHue(localId: string, value: any, callback: any, index: number) {
        this.hue = Math.min(Math.max(normalize(value, 0, 0xFFFF, 254), 0), 254);
        const pixels = new Array(this.strip.pixels.length);
        const color = hsvToRgb(this.hue, this.saturation, this.value);
        for (let i = 0; i < pixels.length; i++) {
            pixels[i] = this.rgb2Int(color.red, color.green, color.blue);
        }
        this.strip.library.render(pixels);
    }

    setMclBrightness(localId: string, value: any, callback: any, index: number) {
        this.value = Math.min(Math.max(normalize(value, 0, 0xFFFF, 254), 0), 254);
        const pixels = new Array(this.strip.pixels.length);
        const color = hsvToRgb(this.hue, this.saturation, this.value);
        for (let i = 0; i < pixels.length; i++) {
            pixels[i] = this.rgb2Int(color.red, color.green, color.blue);
        }
        this.strip.library.render(pixels);
    }

    setSaturation(localId: string, value: any, callback: any, index: number) {
        this.saturation = Math.min(Math.max(normalize(value, 0, 0xFFFF, 254), 0), 254);
        const pixels = new Array(this.strip.pixels.length);
        const color = hsvToRgb(this.hue, this.saturation, this.value);
        for (let i = 0; i < pixels.length; i++) {
            pixels[i] = this.rgb2Int(color.red, color.green, color.blue);
        }
        this.strip.library.render(pixels);
    }
}

function hsvToRgb(hue: number, saturation: number, value: number) {
    const c = value * saturation;
    const h = hue / 60;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = value - c;

    let tmp;
    if (h >= 0 && h < 1)
        tmp = { r: c, g: x, b: 0 };
    else if (h >= 1 && h < 2)
        tmp = { r: x, g: c, b: 0 };
    else if (h >= 2 && h < 3)
        tmp = { r: 0, g: c, b: x };
    else if (h >= 3 && h < 4)
        tmp = { r: 0, g: x, b: c };
    else if (h >= 4 && h < 5)
        tmp = { r: x, g: 0, b: c };
    else if (h >= 5 && h <= 6)
        tmp = { r: c, g: 0, b: x };
    else
        tmp = { r: 0, g: 0, b: 0 };

    return {
        red: Math.round(255 * (tmp.r + m)),
        green: Math.round(255 * (tmp.g + m)),
        blue: Math.round(255 * (tmp.b + m))
    };
}

function normalize(value: number, min: number, max: number, mult: number) {
    mult = mult || 100;
    return Math.round(((value - min) / (max - min)) * mult);
}

// enum Strip {
//     ws2811 = 'WS2811',
//     ws2812 = 'WS2812',
//     sk6812 = 'SK6812',
//     ws2813 = 'WS2813',
//     ws2801 = 'WS2801',
//     apa102 = 'APA102',
//     sk9288 = 'SK9288',
//     lpd8803 = 'LPD8803',
//     lpd8806 = 'LPD8806'
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
    set: (red: number, green: number, blue: number, index?: number) => void; // tslint:disable-line no-reserved-keywords
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
        if (this.intervals)
            while (this.intervals.length > 0)
                clearInterval(this.intervals.pop());
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
                    selector = Math.floor(Math.random() * colors.length); // tslint:disable-line insecure-random
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
        }, 0));
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