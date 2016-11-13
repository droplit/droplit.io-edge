# Web Socket Protocol Specification

All packets are wrapped in a control envelope.
This specification addresses the contents of the messages once the envelope has been processed.

## Cloud to Edge

### `ehlo` - respond with acknowledged
data:

```
"ack"
```

### `discover` - run device discovery or enable auto-discovery
data:
```
{
   interval?: number;
   offset?: number;
}
```
If `interval` is **unspecified**, discovery for all plugins is run immediately
if `interval` **is** specified, discovery is run automatically at the specified interval unless interval = 0, then autodiscovery will be disabled.
All non-zero, non-positive values are reserved for future implementaion, but will disable discovery.
`offset` determines the amount of time between each plugin's discovery cycle.
A two-second offset is recommended for plugins using UPnP on the same IP-based network to allow for devices to recover.

### `device info` - send updated device info
#### data:
The service may send updated device info to the edge
```
{
    deviceId: string;
    pluginName: string;
    localId: string;
    address?: any;
    product?: any;
    localData?: any;
    services?: string[];
    promotedMembers?: { [name: string]: string };
}
```

`device connect`

`device disconnect`

### `property set` - set service properties

#### request:
```
{
    deviceId: string;
    service: string;
    index: string;
    member: string;
    value: any;
}[]
```

#### response:
The response contains an array of supported flags indicating whether the operation is supported by the plugin

```
{
    supported: boolean[];
}
```


### `property get` - get service property values
Gets all the service property values if supported
#### request:
```
{
    deviceId: string;
    service: string;
    index: string;
    member: string;
}[]
```

#### response:
```
{
    values: any[];
    supported: boolean[];
}
```


### `method call` - Call a service method
```
{
    deviceId: string;
    service: string;
    index: string;
    member: string;
    value: any;
}[]
```

#### response:
The response contains an array of supported flags indicating whether the operation is supported by the plugin

```
{
    supported: boolean[];
}
```

### `device message` - send a raw message to a device

#### request:
```
{
    deviceId: string;
    message: any;
}
```

#### response:
```
{
    response: any;
}
```

### `plugin message` - sends a message down to the plugin (not persisted data)
```
{
    pluginName: string;
    message: any;
}
```

#### response:
```
{
    response: any;
}
```


### `plugin setting` - sets ecosystem-wide settings for plugin of a specific type (managed by local cache // persisted in mongo)
```
{
    pluginName: string;
    key: string;
    value: any;
}[]
```

### `plugin data` - sets edge device-wide settings for plugin of a specific type (managed by local cache // persisted in mongo)
```
{
    pluginName: string;
    key: string;
    value: any;
}[]
```

`config set`

### `token update` - send a new edge node token
```
{
    token: string;
}
```

## Edge to Cloud

### `register edge` - regsiter a new edge server

- If the edge Id is new, the system will issue an auth token.
- The auth token must be persisted forever and used for all subsequent communication.
- If the edge Id is already used, the request will have to be reviewed and allowed by a user.

#### request:

```
{
    edgeId: string;
    ecosystemId: string;
    profile: string; // Future use
    software: { name: string; version: string; };
    hardware: { type: string; version: string; };
}
```

#### success response:
Save this token; include it in all subsequent requests

```
{
    token: string;
}
```

#### failure response:
A token will be issued later; when the new edge node has been approved

```
{
    token: null;
}
```

### `device info` - send updated device info

 - Plugins can raise a device info event any time a new device is discovered or an existing device changes in some way.
 - Fields which are specified will be updated; omitted fields will be unmodifidied
 -  To clear the valueof a field, set the field to null

#### request:
```
{
    pluginName: string;
    localId: string;
    address?: any;
    product?: any;
    name?: string;
    location?: string;
    deviceMeta?: any;
    services?: string[];
    promotedMembers?: { [name: string]: string };
}
```
#### response:
The service responds with the current device info including the system assigned deviceId and all fields.
```
{
    deviceId: string;
    pluginName: string;
    localId: string;
    address?: any;
    product?: any;
    name?: string;
    location?: string;
    deviceMeta?: any;
    services?: string[];
    promotedMembers?: { [name: string]: string };
}
```

`property changed`
```
{
    pluginName: string;
    localId: string;
    service: string;
    index: string;
    member: string;
    value: any;
}[]
```

### `event raised` - send updated device info
Device raises an event

#### message:
```
{
    pluginName: string;
    localId: string;
    service: string;
    index: string;
    member: string;
    value: any;
}[]
```

### `log info` - send a info message to the ecosystem log
```
{
    pluginName: string;
    timestamp: string;
    data: any;
}
```

### `log error` - sent a error message to the ecosystem log
```
{
    pluginName: string;
    timestamp: string;
    data: any;
}
```

`discover complete`

`plugin data`