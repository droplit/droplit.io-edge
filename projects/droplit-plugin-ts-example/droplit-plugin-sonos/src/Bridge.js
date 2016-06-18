'use strict';

const EasySax = require('easysax');
const EventEmitter = require('events').EventEmitter;
const http = require('http');
const request = require('request');

const SubscriptionTimeout = 600;

class Bridge extends EventEmitter {
    constructor(init) {
        super();
        
        this.address = init.address;
        this.identifier = init.identifier;
        
        let localAddress;
        let location = init.location;
        let notificationPort = 3500;
        let server = http.createServer(handleNotification.bind(this));
        let subIds = new Map();
        
        server.on('error', e => {
            if (e.code === 'EADDRINUSE')
                startServer(++notificationPort);
            else
                console.log(`listen error: ${e.toString()}`);
        });
        server.on('listening', () => {
            console.log('listening');
            setupSubscriptions.bind(this)();
        });
        
        startServer(notificationPort);
        
        function setupSubscriptions() {
            let options = {
                localAddress,
                hostname: location.hostname,
                path: location.path,
                port: location.port 
            };
            http.get(options, res => {
                localAddress = res.socket.address().address;
                subscribe.bind(this)('/ZoneGroupTopology/Event');
            });
        }
        
        function handleNotification(req, res) {
            res.statusCode = 200;
            let buffer = [];
            req.setEncoding('utf-8');
            req.on('data', chunk => buffer.push(chunk));
            req.on('end', () => {
                res.end();

                let notifyState = {
                    sid: req.headers.sid,
                    nts: req.headers.nts
                };

                let parser = new EasySax();

                parser.on('endNode', (elem, attr, uq, tagend, getStrNode) => {
                    // Ignore these nodes
                    if (elem === 'e:property' || elem === 'e:propertyset')
                        return;

                    notifyState.type = elem;

                    if (elem === 'ZoneGroupState') {
                        console.log(notifyState.body);
                        return;
                    }

                    if (elem === 'ContainerUpdateIDs') {
                        return;
                    }

                    if (elem === 'FavoriteUpdateID') {
                        return;
                    }
                });
                parser.on('textNode', (s, uq) =>
                    notifyState.body = uq(s));

                parser.parse(buffer.join(''));
            });
        }
        
        function startServer(port) {
            server.listen(port);
        }
        
        function subscribe(path) {
            let headers = { TIMEOUT: `Second-${SubscriptionTimeout}` };
            if (subIds.has(path))
                headers.SID = subIds.get(path);
            else {
                headers.CALLBACK = `<http://${localAddress}:${notificationPort}>`;
                headers.NT = 'upnp:event';
            }
            
            let opts = {
                headers,
                method: 'SUBSCRIBE',
                uri: `http://${this.address}:1400${path}`
            };
            request(opts, (e, r, b) => {
                if (e) {
                    console.log('error subscribing', e);
                    return;
                }
                
                subIds.set(path, r.headers.sid);
                if (r.statusCode === 200)
                    setTimeout(() => subscribe.bind(this)(path), SubscriptionTimeout * 500);
                else {
                    subIds.delete(path);
                    setTimeout(() => subscribe.bind(this)(path), 30000);
                }
            });
        }
    }
}

module.exports = Bridge;