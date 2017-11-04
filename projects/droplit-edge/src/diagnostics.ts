import * as debug from 'debug';
import * as cache from './cache';
import * as WebSocket from 'ws';

import net = require('net');
import process = require('process');
import readline = require('readline');

const log = debug('droplit:diagnostics');
const settings = require('../localsettings.json');

let port = 8888;
const sockets: net.Socket[] = [];
const dxData = {
    connected: <Date>null,
    lastHeartbeat: <Date>null,
    lastHeartbeatAttempt: <Date>null,
    lastMessage: <Date>null
};

if (settings.diagnostics && settings.diagnostics.port)
    port = settings.diagnostics.port;

module.exports = (router: any) => {
    const server = net.createServer(connection);
    server.listen(port, () => log(`Diagnostics port ${port}`));

    router.transport.on('attemptHB', () => dxData.lastHeartbeatAttempt = new Date());
    router.transport.on('connected', () => dxData.connected = new Date());
    router.transport.on('hb', () => dxData.lastHeartbeat = new Date());
    router.transport.on('message', () => dxData.lastMessage = new Date());

    function connection(socket: net.Socket) {
        sockets.push(socket);

        log('connected');

        socket.setEncoding('utf8');

        const rl = readline.createInterface(<any>socket, socket);
        socket.write('Edge Diagnostics console\n\r');

        const commands: any = {
            crash: {
                desc: 'Throw an error.',
                exec: () => {
                    throw new Error('This crash is intentional');
                }
            },
            discovered: {
                desc: 'List the cached deviceIds by plugin.',
                exec: () =>
                    router.plugins.forEach((plugin: any) => {
                        const discovered = cache.getDevicesByPlugin(plugin.pluginName);
                        if (discovered.length > 0) {
                            socket.write(`  ${plugin.pluginName}\n\r`);
                            discovered.forEach(device =>
                                socket.write(`    ${device.deviceId}\n\r`));
                        }
                    })
            },
            exit: {
                desc: 'Exit the diagnostic terminal.',
                exec: () =>
                    socket.end('Goodbye!\n\r'),
            },
            help: {
                desc: 'Show commands.',
                exec: () =>
                    Object.keys(commands).forEach(key => {
                        const command = commands[key];
                        socket.write(`  ${key}\n\r`);
                        if (command.desc)
                            socket.write(`    ${command.desc}\n\r`);
                    })
            },
            local: {
                desc: 'Show local settings.',
                exec: () =>
                    socket.write(`  ${JSON.stringify(settings)}\n\r`)
            },
            memory: {
                desc: 'Show memory usage.',
                exec: () =>
                    socket.write(`  ${JSON.stringify(process.memoryUsage())}\n\r`)
            },
            pmsg: {
                desc: 'Send a message to a specified plugin. Command format: `pmsg <plugin> <message>`.',
                exec: (plugin: string, message: string) =>
                    router.sendPluginMessage({ plugin, message }, (value: any) => {
                        if (Array.isArray(value)) {
                            let output = '';
                            value.forEach(v => {
                                if (v.key && typeof v.key === 'string' && v.value && Array.isArray(v.value)) {
                                    output += `  ${v.key}\n\r`;
                                    if (v.value.length > 0)
                                        output += `    ${v.value.join('\n\r    ')}\n\r`;
                                    else
                                        output += '    (none)\n\r';
                                } else if (typeof v === 'object') {
                                    output += '  {\n\r';
                                    output += Object.keys(v)
                                        .map(name => `    ${name}: ${JSON.stringify(v[name])}`)
                                        .join('\n\r');
                                    output += '\n\r  }\n\r';
                                } else
                                    output = `  ${value.join('\n\r  ')}\n\r`;
                            });
                            socket.write(output);
                        }
                        else if (typeof value === 'string')
                            socket.write(value);
                        else
                            socket.write(value.toString());
                    })
            },
            ping: {
                desc: 'Send a test message to the WS server.',
                exec: () => {
                    socket.write('  send message...\n\r');
                    const data = {
                        edgeId: router.macAddress,
                        time: new Date()
                    };
                    router.transport.sendRequest('diagnostics', data, (res: any, err: any) => {
                        if (err)
                            return socket.write(`  error: ${JSON.stringify(err)}\n\r`);
                        socket.write(`  response: ${JSON.stringify(res)}\n\r`);
                    });
                }
            },
            plugins: {
                desc: 'List loaded plugins.',
                exec: () =>
                    socket.write(`  ${(Array as any).from(router.plugins.keys()).join('\n\r  ')}\n\r`)
            },
            socket: {
                desc: 'Display the state of the transport web socket.',
                exec: () => {
                    const readyState = router.transport.getReadyState();
                    const state =
                        (readyState === undefined) ? 'undefined' :
                        (readyState === WebSocket.CLOSED) ? 'closed' :
                        (readyState === WebSocket.CLOSING) ? 'closing' :
                        (readyState === WebSocket.CONNECTING) ? 'connecting' :
                        (readyState === WebSocket.OPEN) ? 'open' :
                        'unknown';
                    socket.write(`  current time:           ${new Date().toISOString()}\n\r`);
                    socket.write(`  last connected at:      ${dxData.connected ? dxData.connected.toISOString() : null}\n\r`);
                    socket.write(`  last heartbeat attempt: ${dxData.lastHeartbeatAttempt ? dxData.lastHeartbeatAttempt.toISOString() : null}\n\r`);
                    socket.write(`  last heartbeat:         ${dxData.lastHeartbeat ? dxData.lastHeartbeat.toISOString() : null}\n\r`);
                    socket.write(`  last message:           ${dxData.lastMessage ? dxData.lastMessage.toISOString() : null}\n\r`);
                    socket.write(`  state:                  ${state}\n\r`);
                }
            }
        };

        rl.on('line', line => {
            const parsed = /^(\S+)(?:\s(.+))?$/.exec(line);
            if (parsed && commands[parsed[1]]) {
                const command = commands[parsed[1]];
                const params = parsed[2] ? parsed[2].split(' ') : [];
                if (command.exec)
                    return command.exec(...params);
            }

            socket.write(`Unknown command: ${line}\n\r`);
        });

        socket.on('end', () => {
            const i = sockets.indexOf(socket);
            if (i !== -1) {
                sockets.splice(i, 1);
                log('disconnected');
            }
        });
    }
};