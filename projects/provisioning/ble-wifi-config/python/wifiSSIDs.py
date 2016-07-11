import subprocess
import time
from wifi import Cell, Scheme
#from wifi.exceptions import ConnectionError
# https://pypi.python.org/pypi/wifi/0.3.2
nets = Cell.all('wlan0')
callback =  "["
for net in nets:
     data = (net.ssid,net.signal,net.frequency,net.encrypted,net.channel,net.address,net.mode)
     callback = callback + "{{\"ssid\":\"{0}\", \"signal\":\"{1}\", \"frequency\":\"{2}\", \"encrypted\":\"{3}\", \"channel\":\"{4}\", \"address\":\"{5}\", \"mode\":\"{6}\"}},".format(*data)
callback = callback[:-1]
callback = callback +  "]"
print callback