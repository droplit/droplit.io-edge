'use strict';

let debug = false;
const packet = {
    setDebug: d => (debug = d)
};

const type = {
    byte2: {
        size: 2,
        parse: (b, start) => b.slice(start, start + 2),
        unparse: (b, start, p) => p.copy(b, start, 0, 2)
    },
    byte4: {
        size: 4,
        parse: (b, start) => b.slice(start, start + 4),
        unparse: (b, start, p) => p.copy(b, start, 0, 4)
    },
    byte6: {
        size: 6,
        parse: (b, start) => b.slice(start, start + 6),
        unparse: (b, start, p) => p.copy(b, start, 0, 6)
    },
    byte8: {
        size: 8,
        parse: (b, start) => b.slice(start, start + 8),
        unparse: (b, start, p) => p.copy(b, start, 0, 8)
    },
    floatLE: {
        size: 4,
        parse: (b, start) => b.readFloatLE(start),
        unparse: (b, start, p) => b.writeFloatLE(p, start)
    },
    string32: {
        size: 32,
        parse: (b, start) => {
            const size = 32;
            const end = start + size;
            let len;
            for (len = start; len < end; len++)
                if (b[len] < 32)
                    break;
            return b.slice(start, len).toString();
        },
        unparse: (b, start, p) => new Buffer(p).copy(b, start, 0, 32)
    },
    uint8: {
        size: 1,
        parse: (b, start) => b.readUInt8(start),
        unparse: (b, start, p) => b.writeUInt8(p, start)
    },
    uint16: {
        size: 2,
        parse: (b, start) => b.readUInt16BE(start),
        unparse: (b, start, p) => b.writeUInt16BE(p, start)
    },
    uint16LE: {
        size: 2,
        parse: (b, start) => b.readUInt16LE(start),
        unparse: (b, start, p) => b.writeUInt16LE(p, start)
    },
    uint32: {
        size: 4,
        parse: (b, start) => b.readUInt32BE(start),
        unparse: (b, start, p) => b.writeUInt32BE(p, start)
    },
    uint32LE: {
        size: 4,
        parse: (b, start) => b.readUInt32LE(start),
        unparse: (b, start, p) => b.writeUInt32LE(p, start)
    },
    uint64: {
        size: 8,
        parse: (b, start) => b.slice(start, start + 8),
        unparse: (b, start, p) => p.copy(b, start, 0, 8)
    }
};

const preambleFields = [
    { name: 'size', type: type.uint16LE },                 // +0
    { name: 'protocol', bits: 12, type: type.uint16LE },   // +2
    { name: 'addressable', bits: 1, type: type.uint8 },
    { name: 'tagged', bits: 1, type: type.uint8 },
    { name: 'origin', bits: 2, type: type.uint8 },
    { name: 'source', type: type.byte4 },                   // +4
    { name: 'target', type: type.byte8 },                   // +8
    { name: 'site', type: type.byte6 },                     // +16
    { name: 'frmRsrv', bits: 6, type: type.uint8 },        // +22
    { name: 'ackRequired', bits: 1, type: type.uint8 },
    { name: 'resRequired', bits: 1, type: type.uint8 },
    { name: 'sequence', type: type.uint8 },                 // +23
    { name: 'timestamp', type: type.uint64 },               // +24
    { name: 'packetType', type: type.uint16LE },           // +32
    { name: 'protoRsrv', type: type.byte2 }                // +34
];

const packets = {
    0x02: {
        name: 'Get Service',
        shortname: 'getService',
        tagged: true,
        length: 0,
        fields: []
    },
    0x03: {
        name: 'State Service',
        shortname: 'stateService',
        length: 5,
        fields: [
            { name: 'service', type: type.uint8 },
            { name: 'port', type: type.uint32LE }
        ]
    },
    0x0D: {
        name: 'State Host Info',
        shortname: 'stateHostInfo',
        length: 14,
        fields: [
            { name: 'signal', type: type.floatLE },
            { name: 'tx', type: type.uint32LE },
            { name: 'rx', type: type.uint32LE },
            { name: 'mcuTemperature', type: type.uint16 }
        ]
    },
    0x11: {
        name: 'State Wifi Info',
        shortname: 'stateWifiInfo',
        length: 14,
        fields: [
            { name: 'signal', type: type.floatLE },
            { name: 'tx', type: type.uint32LE },
            { name: 'rx', type: type.uint32LE },
            { name: 'reserved', type: type.uint16 }
        ]
    },
    0x20: {
        name: 'Get Version',
        shortname: 'getVersion',
        tagged: false,
        length: 0,
        fields: []
    },
    0x21: {
        name: 'State Version',
        shortname: 'stateVersion',
        length: 12,
        fields: [
            { name: 'vendor', type: type.uint32LE },
            { name: 'product', type: type.uint32LE },
            { name: 'version', type: type.uint32LE }
        ]
    },
    0x2D: {
        name: 'Acknowledgement',
        shortname: 'acknowledgement',
        length: 0,
        fields: []
    },
    0x65: {
        name: 'Get Light',
        shortname: 'getLight',
        tagged: false,
        length: 0,
        fields: []
    },
    0x66: {
        name: 'Set Light Color',
        shortname: 'setColor',
        ackRequired: true,
        // resRequired: true,
        length: 13,
        fields: [
            { name: 'reserved', type: type.uint8 },
            { name: 'hue', type: type.uint16LE },
            { name: 'saturation', type: type.uint16LE },
            { name: 'brightness', type: type.uint16LE },
            { name: 'kelvin', type: type.uint16LE },
            { name: 'duration', type: type.uint32LE }
        ]
    },
    0x6B: {
        name: 'Light State',
        shortname: 'lightState',
        length: 52,
        fields: [
            { name: 'hue', type: type.uint16LE },
            { name: 'saturation', type: type.uint16LE },
            { name: 'brightness', type: type.uint16LE },
            { name: 'kelvin', type: type.uint16LE },
            { name: 'reserved', type: type.uint16LE },
            { name: 'power', type: type.uint16LE },
            { name: 'label', type: type.string32 },
            { name: 'reserved2', type: type.uint64 }
        ]
    },
    0x6F: {
        name: 'Light temperature',
        shortname: 'lightTemperature',
        length: 2,
        fields: [
            { name: 'temperature', type: type.uint16LE }
        ]
    },
    0x74: {
        name: 'Get Light Power',
        shortname: 'getLightPower',
        length: 0,
        fields: []
    },
    0x75: {
        name: 'Set Light Power',
        shortname: 'setLightPower',
        ackRequired: true,
        length: 6,
        fields: [
            { name: 'level', type: type.uint16 },
            { name: 'duration', type: type.uint32 }
        ]
    },
    0x76: {
        name: 'State Power',
        shortname: 'statePower',
        length: 6,
        fields: [
            { name: 'level', type: type.uint16 }
        ]
    }
};

packet.fromBytes = b => {
    const newPacket = { preamble: {}, payload: {} };

    // Check minimum packet size
    if (b.length < 36)
        return;

    let offset = 0;
    let bits = 0;
    for (let i = 0; i < preambleFields.length; i++) {
        const f = preambleFields[i];

        const parsed = f.type.parse(b, offset);
        if (f.bits) {
            const bytes = f.type.size * 8;
            let mask = [];
            for (let j = bytes - 1; j >= 0; j--) {
                const bit = (j >= bits && j < (bits + f.bits)) ? 1 : 0;
                mask.push(bit);
            }
            mask = mask.join('');

            const value = (parsed & parseInt(mask, 2)) >>> bits;
            newPacket.preamble[f.name] = value;

            offset += Math.floor(f.bits / 8);
            bits += f.bits % 8;

            if ((bits % 8) === 0) {
                bits = 0;
                offset++;
            }
        } else {
            newPacket.preamble[f.name] = parsed;
            offset += f.type.size;
        }
    }

    const pParser = packets[newPacket.preamble.packetType];
    if (typeof pParser === 'undefined') {
        if (debug) {
            console.log(`unknown type ${newPacket.preamble.packetType}`);
            console.log('bytes', b);
        }
    } else {
        newPacket.packetTypeName = pParser.name;
        newPacket.packetTypeShortName = pParser.shortname;
        pParser.fields.forEach(f => {
            newPacket.payload[f.name] = f.type.parse(b, offset);
            offset += f.type.size;
        });
    }

    return newPacket;
};

packet.fromParams = p => {
    if (typeof p.type === 'undefined') {
        if (debug)
            console.log('Unknown packet type requested');
        return;
    }

    let parser;
    Object.keys(packets).forEach(key => {
        if (packets[key].shortname === p.type) {
            parser = packets[key];
            parser.packetType = key;
        }
    });

    const newPacket = new Buffer(36 + parser.length);
    const newPacketPayload = newPacket.slice(36);

    // Generate packet data
    let offset = 0;
    for (let i = 0; i < parser.fields.length; i++) {
        parser.fields[i].type.unparse(newPacketPayload, offset, p[parser.fields[i].name]);
        offset += parser.fields[i].type.size;
    }

    // Generate preamble
    offset = 0;
    let bits = 0;
    for (let i = 0; i < preambleFields.length; i++) {
        const f = preambleFields[i];
        let datum;
        switch (f.name) {
            case 'size':
                datum = 36 + parser.length;
                break;
            case 'protocol':
                if (typeof p[f.name] === 'undefined') {
                    datum = 0x0400;
                    // Is addressable unless specified otherwise
                    if (!parser.hasOwnProperty('addressable') || parser.addressable === true)
                        datum += 0x1000;

                    if (parser.tagged)
                        datum += 0x2000;
                } else
                    datum = p[f.name];
                break;
            case 'target':
                if (typeof p[f.name] === 'undefined')
                    datum = new Buffer([0, 0, 0, 0, 0, 0, 0, 0]);
                else
                    datum = p[f.name];
                break;
            case 'site':
                if (typeof p[f.name] === 'undefined')
                    datum = new Buffer([0, 0, 0, 0, 0, 0]);
                else
                    datum = p[f.name];
                break;
            case 'frmRsrv':
                if (typeof p[f.name] === 'undefined') {
                    datum = 0;
                    if (parser.resRequired)
                        datum += 0x01;
                    if (parser.ackRequired)
                        datum += 0x02;
                } else
                    datum = p[f.name];
                break;
            case 'source':
                if (typeof p[f.name] === 'undefined')
                    datum = new Buffer([0, 0, 0, 0]);
                else
                    datum = p[f.name];
                break;
            case 'sequence':
                if (typeof p[f.name] === 'undefined')
                    datum = 0;
                else
                    datum = p[f.name];
                break;
            case 'protoRsrv':
            case 'timestamp':
                datum = new Buffer(f.type.size);
                datum.fill(0);
                break;
            case 'packetType':
                datum = parser.packetType;
                break;
        }
        if (datum !== undefined)
            f.type.unparse(newPacket, offset, datum);

        if (f.bits) {
            offset += Math.floor(f.bits / 8);
            bits += f.bits % 8;
            if ((bits % 8) === 0) {
                bits = 0;
                offset++;
            }
        } else
            offset += f.type.size;
    }

    return newPacket;
};

packet.packets = () => packets;

// Create functions on the packet object for each packet type based on its shortname
Object.keys(packets).forEach(p => {
    const packetData = packets[p];
    packet[packetData.shortname] = (pkt =>
        packetObj => {
            if (typeof packetObj !== 'object')
                packetObj = {};
            packetObj.type = pkt.shortname;
            return packet.fromParams(packetObj);
        }
    )(packetData);
});

module.exports = packet;
