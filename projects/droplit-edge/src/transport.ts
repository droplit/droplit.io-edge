import * as WebSocket from 'ws';
import {EventEmitter} from 'events';
const retry = require('retry');

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

    constructor() {
        super();
        EventEmitter.call(this);
    }
    
    public start(settings: any) {
        this.settings = settings;
        this.retryConnect();
    }
    
    private retryConnect() {
        this.connectOperation.attempt((currentAttempt: any) => {
            console.log('reconnecting...');
            this.restart();
        });
    }
    
    private restart() {
        try {
            this.ws = new WebSocket(this.settings.host);
            this.ws.on('open', this.onOpen.bind(this));
            this.ws.on('message', this.onMessage.bind(this));
            this.ws.on('close', this.onClose.bind(this));
            this.ws.on('ping', this.onPing.bind(this));
            this.ws.on('pong', this.onPong.bind(this));
            this.ws.on('error', this.onError.bind(this));
        } catch (err) {
            console.log('connect error', err.stack);
        }
    }
    
    private onOpen() {
        this.isOpen = true;
        this.startHeartbeat();
        this.emit('connected');
    }

    private onMessage(data: any, flags: any) {
        console.log('message', data);
        let packet = JSON.parse(data);
        this.emit('message', data.m);
    }

    private onClose(code: any, message: any) {
        this.ws = undefined;
        if (this.isOpen) {
            this.isOpen = false;
            this.stopHeartbeat();
            this.emit('disconnected');
            this.retryConnect();
        }
    }

    private onPing(data: any, flags: any) {
        
    }

    private onPong(data: any, flags: any) {
        
    }
    
    private onError(error: any) {
        // console.log('conn error', error.stack);
        this.isOpen = false;
        this.stopHeartbeat();
        this.connectOperation.retry(error);
    }
    
    public send(message: string, data?: any, cb?: (err: Error) => void) {
        let packet: any = { m: message, d: data, i: this.getNextMessageId() };
        this._send(JSON.stringify(packet), cb);
    }
    
    private _send(packet: any, cb?: (err: Error) => void) {
        if (this.ws) {
            try {
                this.ws.send(packet, cb);
            } catch (err) {
                console.log('send error', err.stack);
                cb(err);
                this.retryConnect();
            }
        } else {
            cb(new Error('not connected'));
        }
    }
    
    private heartbeatPacket = JSON.stringify({ t: 'hb' });

    private sendHeartbeat() {
        this._send(this.heartbeatPacket);
    }

    public stop() {
        if (this.ws !== undefined) {
            this.ws.close();
            this.ws = undefined;
        }
        this.stopHeartbeat();
        this.emit('disconnected');
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

    // reconnect
        
}


/** references
 * http://websockets.github.io/ws/
 * https://github.com/websockets/ws
 * https://github.com/websockets/ws/blob/master/doc/ws.md
 * http://www.hanselman.com/blog/EnablingWebsocketsForSocketioNodeAppsOnMicrosoftAzure.aspx
 * https://tomasz.janczuk.org/2012/11/how-to-use-websockets-with-nodejs-apps.html
 * https://azure.microsoft.com/en-us/blog/introduction-to-websockets-on-windows-azure-web-sites/
 */