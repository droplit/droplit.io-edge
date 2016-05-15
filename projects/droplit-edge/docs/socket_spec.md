# Web Socket Protocol Specification

All packets are wrapped in a control envelope. 
This specification addresses the contents of the messages once the envelope has been processed.

### Cloud to Edge

#### `discover` - run device discovery or enable auto-discovery
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
  
#### `device info` - send updated device info
 > not yet implemented

`device connect`

`device disconnect`

#### `property set` - set service properties
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


### Edge to Cloud

`device info` => deviceInfo

`property changed`

`event raised`

`log info`

`log error`

`discover complete`

`plugin data`