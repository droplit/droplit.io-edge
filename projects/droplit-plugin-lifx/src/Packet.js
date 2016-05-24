packet = {};

type = {
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
    float_le: {
        size: 4,
        parse: (b, start) => b.readFloatLE(start),
        unparse: (b, start, p) => b.writeFloatLE(p, start)
    },
    string32: {
        size: 32,
        parse: (b, start) => {
            let size = 32;
            let end = start + size;
            let len;
            for (let len = start; len < end; len++)
                if (b[len]< 32)
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
    uint16_le: {
        size: 2,
        parse: (b, start) => b.readUInt16LE(start),
        unparse: (b, start, p) => b.writeUInt16LE(p, start)
    },
    uint32: {
        size: 4,
        parse: (b, start) => b.readUInt32BE(start),
        unparse: (b, start, p) => b.writeUInt32BE(p, start)
    },
    uint32_le: {
        size: 4,
        parse: (b, start) => b.readUInt32LE(start),
        unparse: (b, start, p) => b.writeUInt32LE(p, start)
    },
    uint64: {
        size: 8,
        parse: (b, start) => b.slice(start, start + 8),
        unparse: (b, start, p) => p.copy(b, start, 0, 8)
    },
};

preambleFields = [
    { name: 'size', type: type.uint16_le },
    { name: 'protocol', type: type.uint16_le },
    { name: 'reserved1', type: type.byte4 },
    { name: 'bulbAddress', type: type.byte6 },
    { name: 'reserved2', type: type.byte2 },
    { name: 'site', type: type.byte6 },
    { name: 'reserved3', type: type.byte2 },
    { name: 'timestamp', type: type.uint64 },
    { name: 'packetType', type: type.uint16_le },
    { name: 'reserved4', type: type.byte2 }
];

packets = {
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
            { name: 'port', type: type.uint32_le },
        ]
    },
    0x0D: {
        name: 'State Host Info',
        shortname: 'stateHostInfo',
        length: 14,
        fields: [
            { name: 'signal', type: type.float_le },
            { name: 'tx', type: type.uint32_le },
            { name: 'rx', type: type.uint32_le },
            { name: 'mcuTemperature', type: type.uint16 },
        ]
    },
    0x11: {
        name: 'State Wifi Info',
        shortname: 'stateWifiInfo',
        length: 14,
        fields: [
            { name: 'signal', type: type.float_le },
            { name: 'tx', type: type.uint32_le },
            { name: 'rx', type: type.uint32_le },
            { name: 'reserved', type: type.uint16 },
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
            { name: 'vendor', type: type.uint32 },
            { name: 'product', type: type.uint32 },
            { name: 'version', type: type.uint32 }
        ]
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
        length: 13,
        fields: [
            { name: 'reserved', type: type.uint8 },
            { name: 'hue', type: type.uint16_le },
            { name: 'saturation', type: type.uint16_le },
            { name: 'brightness', type: type.uint16_le },
            { name: 'kelvin', type: type.uint16_le },
            { name: 'duration', type: type.uint32_le }
        ]
    },
    0x6B: {
        name: 'Light State',
        shortname: 'lightState',
        length: 52,
        fields: [
            { name: 'hue', type: type.uint16_le },
            { name: 'saturation', type: type.uint16_le },
            { name: 'brightness', type: type.uint16_le },
            { name: 'kelvin', type: type.uint16_le },
            { name: 'reserved', type: type.uint16_le },
            { name: 'power', type: type.uint16_le },
            { name: 'label', type: type.string32 },
            { name: 'reserved2', type: type.uint64 }
        ]
    },
    0x6F: {
        name:"Light temperature",
		shortname:"lightTemperature",
        length: 2,
        fields: [
            { name: 'temperature', type: type.uint16_le }
        ]
    },
    0x75: {
        name: 'Set Light Power',
        shortname: 'setLightPower',
        length: 6,
        fields: [
            { name: 'level', type: type.uint16 },
            { name: 'duration', type: type.uint32 }
        ]
    }
};

packet.fromBytes = b => {
    let newPacket = { preamble: {}, payload: {} };
    
    // Check minimum packet size
    if (b.length < 36)
        return;
    
    let offset = 0;
    for (let i = 0; i < preambleFields.length; i++) {
        let f = preambleFields[i];
        newPacket.preamble[f.name] = f.type.parse(b, offset);
        offset += f.type.size;
    }
    
    let pParser = packets[newPacket.preamble.packetType];
    if (typeof pParser === 'undefined')
        console.log(`unknown type ${newPacket.preamble.packetType}`);
    else {
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
    if (typeof p.type == 'undefined') {
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
        
    let newPacket = new Buffer(36 + parser.length);
    let newPacketPayload = newPacket.slice(36);
    
    // Generate packet data
    let offset = 0;
    for (let i = 0; i < parser.fields.length; i++) {
        parser.fields[i].type.unparse(newPacketPayload, offset, p[parser.fields[i].name]);
        offset += parser.fields[i].type.size;
    }
    
    // Generate preamble
    offset = 0;
    for (let i = 0; i < preambleFields.length; i++) {
        let f = preambleFields[i];
        let datum;
        switch (f.name) {
            case 'size':
                datum = 36 + parser.length;
                break;
            case 'protocol':
                if (typeof p[f.name] === 'undefined')
                    if (parser.tagged)
                        datum = 0x3400;
                    else
                        datum = 0x1400;
                else
                    datum = p[f.name];
                break;
            case 'bulbAddress':
            case 'site':
                if (typeof p[f.name] === 'undefined')
                    datum = new Buffer([0, 0, 0, 0, 0, 0]);
                else
                    datum = p[f.name];
                break;
            case 'reserved1':
            case 'reserved2':
            case 'reserved3':
            case 'reserved4':
            case 'timestamp':
                datum = new Buffer(f.type.size);
                datum.fill(0);
                break;
            case 'packetType':
                datum = parser.packetType;
                break;
        }
        f.type.unparse(newPacket, offset, datum);
        offset += f.type.size;
    }
    return newPacket;
};

Object.keys(packets).forEach(p => {
    let pkt = packets[p];
    packet[pkt.shortname] = ((pkt) => 
        p => {
            if (typeof p !== 'object')
                p = {};
            p.type = pkt.shortname;
            return packet.fromParams(p);
        }
    )(pkt);
});

module.exports = packet;