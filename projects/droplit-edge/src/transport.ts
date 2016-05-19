import * as WebSocket from 'ws';
import {EventEmitter} from 'events';
const retry = require('retry');
import * as debug from 'debug';
import * as async from 'async';
let log = debug('droplit:transport');

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
    private connectOperation = retry.operation({
        // retries: Infinity,
        factor: 1.5,
        minTimeout: 500,
        maxTimeout: 5000,
        randomize: true,
        forever: true
    });
    private isOpen = false;
    
    // timeout
    private messageTimeout = 5000;
    private messageTimer: NodeJS.Timer = undefined;
    
    // request-response mapping
    private responseMap: {[id: string]: (response: string, err?: Error) => void} = {};

    constructor() {
        super();
        EventEmitter.call(this);
        this.messageTimer = setInterval((<() => void>this.digestCycle.bind(this)), this.messageTimeout);
    }
    
    public start(settings: any) {
        this.settings = settings;
        this.retryConnect();
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
            let success = this.restart();
            if (callback) callback(success);
        });
    }
    
    private restart(): boolean {
        try {
            this.ws = new WebSocket(this.settings.host);
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
    }

    private onMessage(data: any, flags: any) {
        log('message', data);
        let packet = JSON.parse(data);
        if (packet.r === true) {
            // it's a request expecting a response
            this.emit('#' + packet.m, packet.d, (response: any): void => {
                let responseMessageId = packet.i;
                let responsePacket: any = { d: response, r: responseMessageId };
                this._send(JSON.stringify(responsePacket));
            });
        } else if (typeof(packet.r) === 'string') {
            // it's the reponse to a request
            let cb = this.responseMap[packet.r];
            if (cb) {
                cb(packet.d);
                delete this.responseMap[packet.r];
            } else {
                // this shouldn't happen
                log('unknown message response', packet);
            }
        } else {
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
        // log('conn error', error.stack);
        this.isOpen = false;
        this.stopHeartbeat();
        this.connectOperation.retry(error);
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
            cb(undefined, err);
            delete this.responseMap[packet.i];
            log('request send error', packet, err);
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
        }, err => {});
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
        return ++ this.messageIdSeed;
    }
    
    // Heartbeat

    private heartbeatInterval = 1000;
    private heartbeatTimer: NodeJS.Timer = undefined;

    private startHeartbeat() {
        this.stopHeartbeat();
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