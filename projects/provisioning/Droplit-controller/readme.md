```
  ___               _ _ _     _  _      _    
 |   \ _ _ ___ _ __| (_) |_  | || |_  _| |__ 
 | |) | '_/ _ \ '_ \ | |  _| | __ | || | '_ \
 |___/|_| \___/ .__/_|_|\__| |_||_|\_,_|_.__/
              |_|                                                                       
```    

## Configuration
The hub automatically connects to the production servers. To change the host configuration, run the following commands from the installed directory.

Development: `sudo node config.js host dev`

Production: `sudo node config.js host prod`

#Manual installation#
This guide provides information necessary to setup a Droplit controller from a base image of Raspbian. You can download a preconfigured image [here](https://http://www.getdroplit.com/)

###Prerequisites###
* You can obtain the latest build of Raspian here: https://www.raspberrypi.org/downloads/
This guide will be using the 2015-02-16 release (Kernel version 3.18)
* Internet connection, wired or wireless
* For Windows, [win32diskimager](http://sourceforge.net/projects/win32diskimager/)

#Overview#
This guide will consist of installing and configuring the following:
* Imaging the SD card
* [Nodejs](https://nodejs.org/)
* Droplit Hub Application 
* [SaltStack](http://http://saltstack.com/)

Estimated completion time: ~1-2 hours
##Installing Raspbian##
Write the image to an SD.

In raspi-config: 

1. Expand File system (Developers Only)
2. Change the user password (If desired). The default credentials are username:pi, password: raspberry.
3. Internationalization Option. Change the locale and keyboard to en-US UTF-8 as both are defaulted to UK. (Deselect en_GB. Keyboard: "Generic 104-key PC", layout "Other", then "English (US)", then "English US", default, "No compose key", "<No>".) Change the time zone: none of the above; UTC.
4. Advanced Options. Set Memory Split to 16. Rename device to "droplithub".

Note* SSH is disabled in the preconfigured Droplit Controller image

Select finish when done. Reboot if prompted, or if it puts you at a console run 
```
sudo reboot
```

For more information about configuring Wi-Fi on the Raspberry Pi: https://learn.adafruit.com/adafruits-raspberry-pi-lesson-3-network-setup/setting-up-wifi-with-occidentalis
##Update and clean the image##
Before updating we will remove applications we're not using
```
sudo apt-get --purge remove wolfram-engine lightdm lxde.* python-tk python3-tk scratch gtk.* libgtk.* openbox libxt.* lxpanel gnome.* libqt.* libxcb.* libxfont.* lxmenu.* gvfs.* xdg-.* desktop.* tcl.* shared-mime-info penguinspuzzle omxplayer gsfonts
```
When prompted, type ```Y```

Remove Development Packages
```
sudo apt-get purge gcc-4\.[0-5].*
```

Remove stray files
```
sudo rm -rf /usr/share/doc/* /opt/vc/src/hello_pi/hello_video/test.h264 /home/pi/python_games
find /usr/share/locale/* -maxdepth 0 -type d |grep -v en |xargs sudo rm -rf
find /usr/share/man/* -maxdepth 0 -type d |grep -Pv 'man\d' |xargs sudo rm -rf
```

Clean up dependencies
```
sudo apt-get --yes autoremove
```
Save and reboot.

#####Update the Image#####
Update the firmware
```
sudo rpi-update
```

The following updates the applications on the image
```
sudo apt-get update
sudo apt-get upgrade
```
Reboot

#####Minimizing SD card writes#####
To prevent SD card corruption after long periods of use, we are going to disable logging in /var/log
```
sudo nano /etc/fstab
```
Add this line to the end

```
none        /var/log        tmpfs   size=1M,noatime         00
```


For more information, see this article http://www.ideaheap.com/2013/07/stopping-sd-card-corruption-on-a-raspberry-pi/

# Cleaning the image #


## Usefull tools ##
List dir contents and size:
```
du -sh * | sort -h
```

List all packages
```
dpkg-query -f '${binary:Package}\n' -W
```

```
Clear apt-archives
sudo apt-get clean
```



handy: http://www.linuxjournal.com/magazine/reducing-boot-time-embedded-linux-systems?page=0,1

## Purging unneeded packages to reduce image size ##
You may need to elevate to su
```
sudo apt-get remove --auto-remove --purge python* minecraft-pi penguinspuzzle samba* libx11-.* lightdm perl* sonic-pi lxappearance lxpanel lxpolkit lxrandr lxtask lxterminal
```

```
sudo apt-get autoremove --purge libx11-.* lxde-.* raspberrypi-artwork xkb-data omxplayer penguinspuzzle sgml-base xml-core alsa-.* cifs-.* samba-.* fonts-.* desktop-* gnome-.*
```

```
sudo apt-get purge alsa-base alsa-utils aptitude aspell-en blt console-setup consolekit cups-bsd cups-common dbus-x11 desktop-base dictionaries-common dillo fontconfig fontconfig-config  fonts-droid galculator gconf2 gconf2-common gdb gksu gnome-themes-standard gsfonts gsfonts-x11 icelib idle idle-python2.7 idle-python3.2 idle3 leafpad lesstif2 libarchive12 libasound2 libaspell15 libatasmart4 libavcodec53 libbluetooth3 libbluray1 libboost-iostreams1.46.1 libboost-iostreams1.48.0 libboost-iostreams1.49.0 libboost-iostreams1.50.0 libcairo-gobject2 libcairo2 libcdio-cdda1 libcdio-paranoia1 libcdio13 libcolord1 libcroco3 libcups2 libcupsimage2 libcurl3 libdirac-encoder0 libdirectfb-1.2-9 libexif12 libflac8 libfltk1.3 libfm-gtk-bin libfm-gtk1 libfm1 libfontconfig1 libfontenc1 libfreetype6 libgail-3-0 libgail18 libgconf-2-4 libgd2-xpm libgdk-pixbuf2.0-0 libgdu0 libgeoclue0 libgfortran3 libgif4 libgksu2-0 libgl1-mesa-glx libglade2-0 libglapi-mesa libgnome-keyring0 libgphoto2-2 libgphoto2-port0 libgs9 libgsm1 libgstreamer-plugins-base0.10-0 libgstreamer0.10-0 libgtk-3-0 libgtk-3-bin libgtk-3-common libgtk2.0-0 libgtk2.0-common libgtop2-7 libhunspell-1.3-0 libice6 libid3tag0 libimlib2 libimobiledevice2 libjack-jackd2-0 libjasper1 libjavascriptcoregtk-1.0-0 libjavascriptcoregtk-3.0-0 libjson0 liblapack3 liblcms1 liblcms2-2 liblightdm-gobject-1-0 libmad0 libmenu-cache1 libmikmod2 libmng1 libmp3lame0 libnotify4 libobrender27 libobt0 libogg0 libopenjpeg2 libpango1.0-0 libpci3 libpciaccess0 libplist1 libpng12-0 libpoppler19 libportmidi0 libpulse0 libpython2.7 libqt4-svg libqtgui4 libqtwebkit4 libraspberrypi0 librsvg2-2 librtmp0 libsamplerate0 libschroedinger-1.0-0 libsdl-image1.2 libsdl-mixer1.2 libsdl-ttf2.0-0 libsdl1.2debian libsgutils2-2 libsm6 libsmbclient libsmpeg0 libsndfile1 libsoup-gnome2.4-1 libsoup2.4-1 libspeex1 libthai0 libtheora0 libtiff4 libts-0.0-0 libunique-1.0-0 libusbmuxd1 libvorbisenc2 libvorbisfile3 libvpx1 libvte9 libwebkitgtk-1.0-0 libwebkitgtk-3.0-0 libwebp2 libwebrtc-audio-processing-0 libwnck22 libx11-6 libx11-xcb1 libx264-123 libxau6 libxaw7 libxcb-glx0 libxcb-render0 libxcb-shape0 libxcb-shm0 libxcb-util0 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxdmcp6 libxext6 libxfixes3 libxfont1 libxft2 libxi6 libxinerama1 libxkbfile1 libxklavier16 libxml2 libxmu6 libxmuu1 libxp6 libxpm4 libxrandr2 libxrender1 libxres1 libxslt1.1 libxss1 libxt6 libxtst6 libxv1 libxvidcore4 libxxf86dga1 libxxf86vm1 lightdm lightdm-gtk-greeter lxappearance lxde-common lxde-icon-theme lxmenu-data lxpolkit lxrandr lxtask lxterminal menu-xdg midori netsurf-gtk obconf omxplayer openbox pciutils pcmanfm policykit-1 poppler-data pulseaudio python-support python3 python3.2 python3.2-minimal scratch shared-mime-info squeak-vm rc tasksel rc  tcl8.5 tsconf udisks wpagui x11-common x11-utils xarchiver xfonts-utils xinit xpdf xserver-xorg xserver-xorg-core fuse gettext-base gnome-accessibility-themes gnome-themes-standard-data libasprintf0c2 libasyncns0 libaudit0 libavutil51 libcaca0 libfftw3-3 libfile-copy-recursive-perl libfm-data libfuse2 libgs9-common libijs-0.35 libjbig2dec0 libmtdev1 libpaper-utils libpaper1 libqt4-dbus libqt4-network libqt4-xml libqtdbus4 libspeexdsp1 libsystemd-daemon0 libva1 libvte-common libwebkitgtk-3.0-common libwnck-common qdbus rtkit update-inetd zenity-common debian-reference-common debian-reference-en && sudo apt-get autoremove
```

## Update kernel using rpi-update ##

```
sudo apt-get install rpi-update
```

## Upgrade to debian 8 ##
```
cp /etc/apt/sources.list /etc/apt/sources.list.bak
echo "deb http://mirrordirector.raspbian.org/raspbian jessie main contrib non-free firmware rpi" > /etc/apt/sources.list
echo "deb http://archive.raspbian.org/raspbian jessie main" >> /etc/apt/sources.list

```
## Update the package lists and upgrade:##

```
apt-get update && apt-get -y dist-upgrade && apt-get -y autoremove
```
May take 2 hours

###Remove unneeded files###

```
remove	/boot.bak /lib/modules.bak /usr/games
```




Potentially remove /var/lib/apt/lists 

See: http://askubuntu.com/questions/179955/var-lib-apt-lists-huge-in-12-04

https://wiki.debian.org/ReduceDebian




## Modify Swap file ## 

Change raspberry pi swap file size (dphys-swapfile): 
http://www.ideaheap.com/2013/07/stopping-sd-card-corruption-on-a-raspberry-pi/

After removing swap:
```
sudo apt-get remove --auto-remove --purge dphys-swapfile
```
(Removes dphys-swapfile and dc)



## Fixing crda ##
If crda errors exist do

```
sudo apt-get install crda
```
then 
```
sudo nano /etc/default/crda 
```

fix REGDOMAIN=US https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2

## Remove NFS ##
```
sudo apt-get --purge --auto-remove remove nfs-kernel-server nfs-common portmap
```
## Remove rpcbind startup service ##
```
sudo apt-get purge rpcbind
```

## Remove TriggerHappy and raspi-config (Hotkey) ##
```
sudo apt-get remove --auto-remove --purge triggerhappy
```

## Remove java ##
```
sudo apt-get remove --auto-remove --purge java-common
```

## Remove unused locales ##
 also set  locale to en-us:
 
```
sudo apt-get install localepurge
sudo localepurge
sudo apt-get remove --auto-remove --purge localepurgedf
```

Remove foreign language man files

```
sudo rm -rf /usr/share/man/??
sudo rm -rf /usr/share/man/??_*
```

## Install ngetty ##
Reduces memory usage
```
sudo apt-get install ngetty
```

**Note also remove firmware for unused wireless chipsets

## Speed up dhcpcd by disableing ARP probing ##
Helps with bootup time, saves about 5sec

```
sudo nano /etc/dhcpcd.conf 
```

noarp
see: https://wiki.archlinux.org/index.php/Dhcpcd#Speed_up_DHCP_by_disabling_ARP_probing

## Install git ##
If needed
```
sudo apt-get install git
```

## Disable kernel logging to console ##
http://superuser.com/questions/351387/how-to-stop-kernel-messages-from-flooding-my-console

```
sudo nano /etc/sysctl.conf
```

Uncomment the following to stop low-level messages on console
```
kernel.printk = 3 4 1 3
```


## Disable ssh ##
```
sudo update-rc.d ssh disable
```

To enable ssh

```
sudo update-rc.d ssh enable
```

##Nodejs##
To install the v0.10.36 Nodejs for Arm
```
wget http://node-arm.herokuapp.com/node_0.10.36_armhf.deb 
sudo dpkg -i node_0.10.36_armhf.deb
```
Clean up files afterwards

```
rm node_0.10.36_armhf.deb
```

##NPM##
To upgrade to the latest stable npm:

``` sudo npm install npm@latest -g ```

##Bluetooth packages##
To install the necessary Bluetooth packages, run
```
sudo apt-get install bluetooth bluez-utils libbluetooth-dev
```

##Setting up USB mounting##
The wifi configuration can be configured using a USB mass storage device. 

```
mkdir usbdrv
sudo sh -c "echo '/dev/sda1 /home/pi/usbdrv vfat uid=pi,gid=pi,umask=0022,sync,auto,nosuid,rw,nouser 0 0' >> /etc/fstab"
```

####Usage:#### 
* Create "droplit_wifi_config.txt", located on the root of a FAT formatted USB drive.
* Power off the droplit hub
* Insert the USB device
* Power on the droplit hub
* Allow 3-5 minutes for the device to establish a wireless connection

http://www.instructables.com/id/Mounting-a-USB-Thumb-Drive-with-the-Raspberry-Pi/step3/Set-up-a-mounting-point-for-the-USB-drive/



## Install openzwave

Install pre-requisites
```
sudo apt-get install libudev-dev
```

Download the source code
```
wget http://old.openzwave.com/snapshots/openzwave-1.3.526.tar.gz
```

Extract
```
tar zxvf openzwave-*.gz
```

Compile and Install
```
cd openzwave-*
make && sudo make install
```
Cleanup the install files
```
cd ..
rm openzwave-*.gz
rm -rf openzwave-*
```

Update environment variable
```
export LD_LIBRARY_PATH=/usr/local/lib
sudo sed -i '$a LD_LIBRARY_PATH=/usr/local/lib' /etc/environment
```

Somehow make the OS aware that it needs to share this shared object thing
```
cd /usr/local/lib
sudo ldconfig
```

Return to home directory
```
cd /home/pi
```

I guess this adds something to `/etc/ld.so.conf.d/`
See https://bbs.archlinux.org/viewtopic.php?id=177790

### Some things to know

You can test OpenZwave by running `MinOZW` from any directory

It resides in this directory
```
/usr/local/bin/MinOZW
```
### Places where OpenZwave puts stuff
Shared library files
```
/usr/local/lib
```

CPP header files
```
/usr/local/include/openzwave
```

documentation
```
/usr/local/share/doc/openzwave-1.2.0
```

### Updating openzwave-shared node library ###
The node openzwave library has to be compiled
```
cd droplitcontroller
npm uninstall openzwave-shared
npm install openzwave-shared
```


## Setting up the hub code on a new image

Download code:
`git clone https://bitbucket.org/droplit/droplitcontroller.git --depth=1`

Install service:
`sudo node droplitcontroller/config.js install`

Enable service on startup:
`sudo systemctl enable droplit`

Once enabled, the service will automatically start on next boot.

### Other information

Start Service: `sudo service droplit start`

Stop Service: `sudo service droplit stop`

Restart Service: `sudo service droplit restart`

Check if enabled: `sudo systemctl is-enabled droplit`

more reference: https://wiki.archlinux.org/index.php/Systemd 

service config here (for reference): `/etc/systemd/system/droplit.service`

# Copying the sd image #

On mac
copy device to img file (6,400,000 blocks = 3,276,800,000 bytes)

```
sudo dd /dev/{device} /path/my_image.img count=6400000
```

See http://computers.tutsplus.com/articles/how-to-clone-raspberry-pi-sd-cards-using-the-command-line-in-os-x--mac-59911


##Installing SaltStack##

See http://docs.saltstack.com/en/latest/topics/installation/debian.html

Add the following to ```/etc/apt/sources.list```

NOTE: Update to jessie


```
deb http://debian.saltstack.com/debian wheezy-saltstack main
```

Then run

```
sudo apt-get update
sudo apt-get install salt-minion
```

Salt-minion will automatically be added as a daemon in upstart


#####Fix for connection loss#####

Known issues involving connection loss are solved in zmq 3.2. To update the messaging kernal run:
 
```
sudo apt-get install libzmq3-dev
```

Then reboot.

See http://www.itsprite.com/centos-linux-how-to-upgrade-zmq2-x-to-zmq-4-x/

####Configuring SaltStack####

*Note: This is the final step in creating the droplit image before capturing the image. If you wish to make any more changes, do so now.

This creates a single use upstart service that configures saltstack next time the device starts up, or when this service is run.

```
sudo cp ~/droplitcontroller/upstart/droplit-setup.conf /etc/init
``` 
If you wish to configure saltstack now reboot, otherwise shutdown and 

```
sudo poweroff
``` 

####Restoring the one time setup####
If you have to redo the single use configuration, simply re-run:

```
sudo cp ~/droplitcontroller/upstart/droplit-setup.conf /etc/init
``` 

## Capturing the image ##

Make sure to shutdown gracefully so as not to corrupt the image
```
sudo poweroff
```

##Using Samba to transfer files##

http://raspberrywebserver.com/serveradmin/share-your-raspberry-pis-files-and-folders-across-a-network.html

Modify samba conf
```
security = share
```
Add
```
guest account = nobody
```
