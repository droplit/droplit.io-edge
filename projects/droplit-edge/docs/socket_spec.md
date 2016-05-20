# Web Socket Protocol Specification

All packets are wrapped in a control envelope. 
This specification addresses the contents of the messages once the envelope has been processed.

## Cloud to Edge

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
    name?: string;
    location?: string;
    deviceMeta?: any;
    services?: string[];
    promotedMembers?: { [name: string]: string };
}
```

`device connect`

`device disconnect`

### `property set` - set service properties
```
{
    deviceId: string;
    pluginName: string;
    service: string;
    index: string;
    member: string;
    value: any;
}[]
```

`device message` - send a raw message to a device

`property get`

`method call`

`plugin message`

`plugin setting`

`plugin data`

`config set`


## Edge to Cloud

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

`event raised`

`log info`

`log error`

`discover complete`

`plugin data`