import * as WebSocket from 'ws';
import {EventEmitter} from 'events';

export default class Transport extends EventEmitter {
    
    // Connection
    private ws: WebSocket = undefined;

    constructor() {
        super();
        EventEmitter.call(this);
    }
    
    public start(settings: any) {
        this.ws = new WebSocket(settings.host);
        this.ws.on('open', this.onOpen);
        this.ws.on('message', this.onMessage);
        this.ws.on('close', this.onClose);
        this.ws.on('ping', this.onPing);
        this.ws.on('pong', this.onPong);
    }
    
    private onOpen() {
        this.startHeartbeat();
        this.emit('connected');
    }

    private onMessage(data: any, flags: any) {
        let packet = JSON.parse(data);
        this.emit('message', data.m);
    }

    private onClose(code: any, message: any) {
        this.emit('disconnected');
    }

    private onPing(data: any, flags: any) {
        
    }

    private onPong(data: any, flags: any) {
        
    }
    
    public send(message: string, data?: any, cb?: (err: Error) => void) {
        let packet: any = { m: message, d: data, i: this.getNextMessageId() };
        this.ws.send(JSON.stringify(packet), cb);
    }
    
    private heartbeatPacket = JSON.stringify({ t: 'hb' });

    private sendHeartbeat() {
        this.ws.send(this.heartbeatPacket);
    }

    public stop() {
        if (this.ws !== undefined) {
            this.ws.close();
            this.ws = undefined;
        }
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
        this.heartbeatTimer = setInterval(this.performHeartbeat, this.heartbeatInterval);
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