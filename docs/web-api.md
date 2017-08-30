# Droplit.io-Edge REST Api

Depending on your device configuration the default IP Address may be different.
### Definition 
```GET: http://192.168.88.1:81/droplit-edge ```

Return the edge mac address
### Result Format
* 200 OK 
``` 
    {
        "edgeId" : "00-00-5E-00-53-XX"
    } 
```
* 400 Bad request - no content
---
### Definition 
```GET: http://192.168.88.1:81/droplit-edge/config/wifi```

Return a list of scanned wifi in the area
### Result Format 
* 200 OK
``` 
    [
         {
            "address": "AB:CD:EF:12",
            "essid": "droplit",
            "mode": "Master",
            "channel": 11,
            "signal": -40,
            "quality": "60/70",
            "encryption": "mixed WPA/WPA2 PSK (CCMP)",
            "uci": "psk2-ccmp"
        }
    ]
```
#### `signal`
Signal strength in dB
#### `encryption`
User readable description of the encryption type
#### `uci`
The encryption parameter that should be used as the value for `AUTH_SUITE`

* 400 Bad request - no content

---
### Definition 
```PUT: http://192.168.88.1/:81droplit-edge/config/wifi ```

Connect to a specified wifi provided in body params
> Note You will lose connection to the edge after this request is made since the edge will switch from router mode to client connecting to internet
### Paramters: 
```
Body:
    {
        "SSID" : "Your_Network"
        "PASS" : "Your_Network_Password"
        "AUTH_SUITE" : "UCI_Encryption_Type"
    }
```
#### Valid `AUTH_SUITE` values are:
```
wep+open
wep+shared
wep+mixed
psk2+tkip+ccmp
psk2+tkip+aes
psk2+tkip 
psk2+ccmp
psk2+aes
psk2
psk+tkip+ccmp
psk+tkip+aes
psk+tkip
psk+ccmp
psk+aes
psk
psk-mixed+tkip+ccmp
psk-mixed+tkip+aes
psk-mixed+tkip 	
psk-mixed+ccmp
psk-mixed+aes
psk-mixed
```
For more information see: https://wiki.openwrt.org/doc/uci/wireless#wpa_modes
### Result Format 
* Status: 200 OK - no content (check to see if edge is connected to internet)
* 400 Bad request - no content

