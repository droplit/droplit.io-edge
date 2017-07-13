# WEB-API NOTES (Revision 1)

## Endpoints

### Return the edge mac address
* Definition 
    * ```GET: http://192.168.1.1:81/droplit-edge ```
* Result Format
    * 200 OK 
    * ``` 
        {
            "edgeId" : "00-00-5E-00-53-XX"
        } 
         ```
    * 400 Bad request - no content
    * 401 Unauthorized - no content
### Return a list of scanned wifi in the area
* Definition 
    * ```GET: http://192.168.1.1:81/droplit-edge/config/wifi```
* Result Format 
    * 200 OK
    * ``` 
        {
            "SSID" : "droplit_5G",
            "CIPHER" : "PSK",
            "AUTH_SUITE" : "PSK-MIXED"
        }
        ```
    * 400 Bad request - no content
    * 401 Unauthorized - no content
### Connect to a specified wifi provided in body params
* Definition (Note You will lose connection to the edge after this request is made since the edge will switch from router mode to client connecting to internet)
    * ```PUT: http://192.168.1.1/:81droplit-edge/config/wifi ```
* Paramters: 
    * ```
        Body 

        {
            "SSID" : "SSID_NAME:
        }
      ```
* Result Format 
    * Status: 200 OK - no content (check to see if edge is connected to internet)
    * 400 Bad request - no content
    * 401 Unauthorized - no content

