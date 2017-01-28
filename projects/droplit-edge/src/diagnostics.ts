import * as debug from 'debug';
import * as router from './router';

import net = require('net');
import readline = require('readline');

const PassThrough = require('stream').PassThrough;

const log = debug('droplit:diagnostics');
const settings = require('../localsettings.json');

let port = 8888;
const sockets: net.Socket[] = [];

if (settings.diagnostics && settings.diagnostics.port)
    port = settings.diagnostics.port;

const server = net.createServer(connection);
server.listen(port, () => log(`Diagnostics port ${port}`));

function connection(socket: net.Socket) {
    sockets.push(socket);

    log('connected');

    socket.setEncoding('utf8');

    const rl = readline.createInterface(socket, socket);
    socket.write('Edge Diagnostics console\n\r');

    const commands: any = {
        exit: () =>
            socket.end('Goodbye!\n\r'),
        help: () =>
            socket.write(`  ${Object.keys(commands).join(', ')}\n\r`),
        local: () =>
            socket.write(`  ${JSON.stringify(settings)}\n\r`),
        plugins: () =>
            socket.write(`  ${(Array as any).from(router.plugins.keys()).join(',\n\r  ')}\n\r`),
        socket: () => {
            const state = router.transport.getState();
            socket.write(`  last connected at:      ${state.connectedAt.toISOString()}\n\r`);
            socket.write(`  current time:           ${new Date().toISOString()}\n\r`);
            socket.write(`  last heartbeat:         ${state.lastHeartbeat.toISOString()}\n\r`);
            socket.write(`  last heartbeat attempt: ${state.lastHeartbeat.toISOString()}\n\r`);
            socket.write(`  state:                  ${state.state}\n\r`);
        }
    };

    rl.on('line', line => {
        if (commands[line])
            commands[line]();
        else
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