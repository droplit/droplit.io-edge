import * as droplit from 'droplit-plugin';
export class NeopixelPlugin extends droplit.DroplitPlugin {
    private numLeds: number;
    private strip: PiStrip;
    private services: any;
    constructor() {
        super();
        this.services = {
            BinarySwitch: {
                get_switch: this.getSwitch,
                set_switch: this.setSwitch,
                switchOff: this.switchOff,
                switchOn: this.switchOn
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
                const pixels = new Array(this.strip.pixels.length);
                if (index === undefined) {
                    for (let i = 0; i < pixels.length; i++) {
                        pixels[i] = this.rgb2Int(red, green, blue);
                    }
                } else {
                    for (let i = 0; i < pixels.length; i++) {
                        if (i == index) {
                            pixels[i] = this.rgb2Int(red, green, blue);
                        } else {
                            pixels[i] = this.rgb2Int(this.strip.pixels[i].red, this.strip.pixels[i].green, this.strip.pixels[i].blue);
                        }
                    }
                }
                this.strip.library.render(pixels);
            });
        }
    }

    private rgb2Int(r: number, g: number, b: number) {
        return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
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

    // BinarySwitch Implementation
    getSwitch(localId: string, callback: any) {
        // return this.strip
        callback();
    }

    setSwitch(localId: string, value: any, index: string) {
        if (value !== 'on' && value !== 'off')

            return true;
    }

    switchOff() {
        console.log('switchOff');
        this.strip.turnOff();
        return true;
    }

    switchOn() {
        console.log('switchOn');
        this.strip.turnOn();
        return true;
    }
}


enum Strip {
    ws2811 = 'WS2811',
    ws2812 = 'WS2812',
    sk6812 = 'SK6812',
    ws2813 = 'WS2813',
    ws2801 = 'WS2801',
    apa102 = 'APA102',
    sk9288 = 'SK9288',
    lpd8803 = 'LPD8803',
    lpd8806 = 'LPD8806'
};

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