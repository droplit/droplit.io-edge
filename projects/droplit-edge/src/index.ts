import Transport from './transport';

let settings = require('../settings.json');

let transport = new Transport();

transport.on('connected', () => {
    console.log('connected');
});

transport.on('disconnected', () => {
    console.log('disconnected');
});

transport.start(settings.transport);