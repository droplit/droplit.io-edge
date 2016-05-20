# Transport Layer Specification

This document specifies the control envelopes that packets are wrapped in.

## Standard Packet Envelope

```
{
    m: string;
    d: any;
    i: string;
}
```

`m` - message type
`d` - message data
`i` - message Id

 > Message Ids: From the _edge_, Ids are assigned sequentially from 1 to Number.MAX_SAFE_INTEGER. From the cloud, message Ids are assigned a 24 character hexidecimal string.
 
## Request-Response Packets

Messages can be sent expecting a response. In this case, a `r` field is used.

### Request Packet Envelope

```
{
    m: string;
    d: any;
    i: string;
    r: bool;
}
```

When `r` is `true`, the packet indicates that a response is expected.

Example request:
```
{
    m: "device message",
    d: {deviceId: "D53c19b2f3008801c0f4c3dca", message: "hello device"},
    i: "53c09265db69fd3c0e69640c",
    r: true
}
```

### Response Packet Envelope

```
{
    d: any;
    r: string;
}
```
When `r` is a `string` that contains the original message id, the packet is a response to an outstanding request.

Example response:
```
{
    d: true,
    r: "53c09265db69fd3c0e69640c"
}
```