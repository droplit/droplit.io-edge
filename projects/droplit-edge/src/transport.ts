import * as WebSocket from 'ws';
import {EventEmitter} from 'events';
const retry = require('retry');
import * as debug from 'debug';
import * as async from 'async';
let log = debug('droplit:transport-edge');

/**
 * Connected event
 *
 * @event Transport#connected
 * @type {object}
 */

/**
 * Disconnected event
 *
 * @event Transport#disconnected
 * @type {object}
 */

/**
 * Message event indicates that a message was received
 *
 * @event Transport#message
 * @type {object}
 * @property {string} message - #message
 * @property {any} data - Contents of the message
 * @propetry {function} callback - response callback if expected
 */

/**
 * Provides communication with droplit.io
 *
 * @export
 * @class Transport
 * @extends {EventEmitter}
 */
export default class Transport extends EventEmitter {
    // Connection
    private ws: WebSocket = undefined;
    private settings: any = undefined;
    private transportId: number = undefined;
    private connectOperation = retry.operation({
        // retries: Infinity,
        factor: 1.5,
        minTimeout: 500,
        maxTimeout: 5000,
        randomize: true,
        forever: true
    });
    private isOpen = false;
    private headers: { [key: string]: string } = undefined;
    private connectedCallback: (connected: boolean) => void = undefined;

    // timeout
    private messageTimeout = 5000;
    private messageTimer: NodeJS.Timer = undefined;

    // request-response mapping
    private responseMap: { [id: string]: (response: string, err?: Error) => void } = {};
    private reliableResponseMap: { [id: string]: (response: string, err?: Error) => void } = {};

    constructor() {
        super();
        EventEmitter.call(this);
        this.messageTimer = setInterval((<() => void>this.digestCycle.bind(this)), this.messageTimeout);
    }

    public start(settings: any, headers: { [key: string]: string }, callback?: (connected: boolean) => void) {
        this.settings = settings;
        this.transportId = this.settings.transportId;
        this.headers = headers;
        this.retryConnect();
        this.connectedCallback = callback;
    }

    public stop() {
        if (this.ws !== undefined) {
            this.ws.close();
            this.ws = undefined;
        }
        this.stopHeartbeat();
        log('disconnected');
        this.emit('disconnected');
    }
    // reconnect

    private retryConnect(callback?: (success: boolean) => void) {
        this.connectOperation.attempt((currentAttempt: any) => {
            log('reconnecting...');
            if (this.settings.hasOwnProperty('transportId')) {
            console.log('retry!: ', this.transportId, currentAttempt);

                this.emit(`#retry:${this.transportId}`, currentAttempt, this.transportId);
            }
            let success = this.restart();
            if (callback) callback(success);
        });
    }

    private restart(): boolean {
        try {
            this.ws = new WebSocket(this.settings.host, {
                headers: this.headers
            });
            this.ws.on('open', this.onOpen.bind(this));
            this.ws.on('message', this.onMessage.bind(this));
            this.ws.on('close', this.onClose.bind(this));
            this.ws.on('ping', this.onPing.bind(this));
            this.ws.on('pong', this.onPong.bind(this));
            this.ws.on('error', this.onError.bind(this));
            return true;
        } catch (err) {
            console.log('connect error', err.stack);
        }
        return false;
    }

    private onOpen() {
        this.isOpen = true;
        this.startHeartbeat();
        this.sendBacklog();
        log('connected');
        this.emit('connected');
        if (this.connectedCallback) {
            this.connectedCallback(true);

            this.connectedCallback = undefined;
        }
    }

    private onMessage(data: any, flags: any) {
        // log('onMessage: message', JSON.parse(data));
        let packet: any;
        try {
            packet = JSON.parse(data);
        } catch (err) {
            log('onMessage: message is not valid JSON');
        }
        if (!packet)
            return;

        if (packet.r === true) {
            // log(`onMessage: request expecting a result`);
            // it's a request expecting a response
            this.emit('#' + packet.m, packet.d, (response: any): void => {
                let responseMessageId = packet.i;
                let responsePacket: any = { d: response, r: responseMessageId };
                this._send(JSON.stringify(responsePacket));
            });
        } else if (typeof (packet.r) === 'string') {
            // log(`onMessage: response to request`);
            // it's the reponse to a request
            let cb = this.responseMap[packet.r] || this.reliableResponseMap[packet.r];
            if (cb) {
                // log(`onMessage: callback found`);
                cb(JSON.stringify(packet.d));
                delete this.responseMap[packet.r];
                delete this.reliableResponseMap[packet.r];
            } else {
                log(`onMessage: callback not found`);
                // this shouldn't happen
                log('unknown message response', packet);
            }
        } else {
            // log(`onMessage: it's a normal message`);
            // it's a normal message
            this.emit('#' + packet.m, packet.d);
        }
    }

    private onClose(code: any, message: any) {
        this.ws = undefined;
        if (this.isOpen) {
            this.isOpen = false;
            this.stopHeartbeat();
            log('disconnected');
            this.emit('disconnected');
            this.retryConnect();
        }
    }

    private onPing(data: any, flags: any) {
        log('ping');
    }

    private onPong(data: any, flags: any) {
        log('pong');
    }

    private onError(error: any) {
        log('conn error', error.stack);
        this.isOpen = false;
        this.stopHeartbeat();
        this.connectOperation.retry(error);
        if (this.connectedCallback) {
            this.connectedCallback(false);
            this.connectedCallback = undefined;
            log(`onError:`, error);
        }
    }

    public send(message: string, data?: any, cb?: (err: Error) => void) {
        let packet: any = { m: message, d: data, i: this.getNextMessageId() };
        this._send(JSON.stringify(packet), cb);
    }

    public sendReliable(message: string, data?: any) {
        let packet: any = { m: message, d: data, i: this.getNextMessageId() };
        this._send(JSON.stringify(packet), (err) => {
            if (err) {
                this.queue(packet);
            }
        });
    }

    public sendRequest(message: string, data: any, cb: (response: string, err: Error) => void) {
        let packet: any = { m: message, d: data, i: this.getNextMessageId(), r: true };
        this.responseMap[packet.i] = cb;
        this._send(JSON.stringify(packet), (err) => {
            // only happens if there was an error, so presumably the callback won't be called from a valid response
            if (err) {
                cb(undefined, err);
                delete this.responseMap[packet.i];
                log('request send error', packet, err);
            }
        });
    }

    public sendRequestReliable(message: string, data: any, cb: (response: string, err: Error) => void) {
        let packet: any = { m: message, d: data, i: this.getNextMessageId(), r: true };
        this.reliableResponseMap[packet.i] = cb;
        this._send(JSON.stringify(packet), (err) => {
            // only happens if there was an error, so presumably the callback won't be called from a valid response
            if (err) {
                this.queue(packet);
                log('reliable request send error - will retry', packet, err);
            }
        });
    }

    private sendBuffer: any[] = [];

    private queue(packet: any) {
        this.sendBuffer.push(packet);
    }

    private peek(): any {
        if (this.sendBuffer.length > 0) {
            return this.sendBuffer[0];
        } else {
            return undefined;
        }
    }

    private canPeek(): boolean {
        return this.sendBuffer.length > 0;
    }

    private queueAndPeek(packet: any): any {
        this.queue(packet);
        return this.sendBuffer[0];
    }

    private dequeue(): any {
        return this.sendBuffer.shift();
    }

    private _send(packet: any, cb?: (err: Error) => void) {
        if (this.ws) {
            try {
                this.ws.send(packet, cb);
            } catch (err) {
                log('send error', err.stack, this.ws);
                if (cb) {
                    cb(err);
                }
                this.retryConnect();
            }
        } else {
            // connection was closed intentionally or never opened
            cb(new Error('not connected'));
        }
    }

    private sendBacklog() {
        async.whilst(this.canPeek.bind(this), (cb: (err: Error) => void) => {
            let nextPacket = this.peek();
            if (!nextPacket)
                return;

            this._send(nextPacket, err => {
                if (!err)
                    this.dequeue();
                cb(err);
            });
        }, err => { });
    }

    // message callback expiration handler

    private prevMessageId: number = undefined;

    private digestCycle() {
        // cleanup the second-to-last cycle
        let messageIds = Object.keys(this.responseMap);
        messageIds.forEach((messageId) => {
            let id = parseInt(messageId);
            if (this.prevMessageId < this.messageIdSeed) {
                /**
                 * message ids have NOT recycled
                 *
                 *   [] = full range: 0..Number.MAX_SAFE_INTEGER
                 *   <  = prevMessageId
                 *   >  = messageIdSeed (next messageId)
                 *   -  = active messageId (not yet responded to or digested)
                 *   o  = id
                 *
                 *   [      -o-<--->      ]
                 *   [o<--->            --]
                 */
                if (id <= this.prevMessageId || id > this.messageIdSeed) {
                    let cb = this.responseMap[messageId];
                    cb(undefined, new Error('timeout expired'));
                    delete this.responseMap[messageId];
                }
            } else {
                /**
                 * message ids HAVE recycled
                 *
                 *   [] = full range: 0..Number.MAX_SAFE_INTEGER
                 *   <  = prevMessageId
                 *   >  = messageIdSeed (next messageId)
                 *   -  = active messageId
                 *   o  = id
                 *
                 *   [--->      -o-<    --]
                 */
                if (id <= this.prevMessageId && id > this.messageIdSeed) {
                    let cb = this.responseMap[messageId];
                    cb(undefined, new Error('timeout expired'));
                    delete this.responseMap[messageId];
                }
            }
        });
        // shift the ids down, store the current id for the next cycle
        this.prevMessageId = this.messageIdSeed;
    }

    private heartbeatPacket = JSON.stringify({ t: 'hb' });

    private sendHeartbeat() {
        this._send(this.heartbeatPacket);
    }

    // Message Id
    private messageIdSeed = 0;

    private getNextMessageId() {
        if (this.messageIdSeed === (<any>Number).MAX_SAFE_INTEGER) this.messageIdSeed = 0;
        return ++this.messageIdSeed;
    }

    // Heartbeat

    private heartbeatInterval = 2000;
    private heartbeatTimer: NodeJS.Timer = undefined;

    private startHeartbeat() {
        this.stopHeartbeat();
        if (this.settings.hasOwnProperty('enableHeartbeat') && !this.settings.enableHeartbeat)
            return;

        this.heartbeatTimer = setInterval(<() => void>(this.performHeartbeat.bind(this)), this.heartbeatInterval);
    }

    private performHeartbeat() {
        this.sendHeartbeat();
    }

    private stopHeartbeat() {
        if (this.heartbeatTimer !== undefined) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
    }

}

/** references
 * http://websockets.github.io/ws/
 * https://github.com/websockets/ws
 * https://github.com/websockets/ws/blob/master/doc/ws.md
 * http://www.hanselman.com/blog/EnablingWebsocketsForSocketioNodeAppsOnMicrosoftAzure.aspx
 * https://tomasz.janczuk.org/2012/11/how-to-use-websockets-with-nodejs-apps.html
 * https://azure.microsoft.com/en-us/blog/introduction-to-websockets-on-windows-azure-web-sites/
 */
