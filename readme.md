```
 _| _ _  _ |.|_   . _  
(_|| (_)|_)|||_.o |(_) 
        |             
```
# BETA Droplit.io Edge Solution

Droplit.io Edge is the software that creates a connection to the Droplit.io cloud. This is typically run from an embedded device to control devices on the local network. 

In order to run the Droplit.io Edge software, you must:

1. Configure your environment
2. Download the repository and its dependencies
3. Create a local configuration
4. Build the solution
5. Run
6. Enjoy


Currently we support these platforms:

* Raspberry Pi 3 (Raspbian Lite 2016-05-27)

Platforms with limited support:

* Openwrt 
* DDWRT
* Windows 10 on desktop
* macOS 10.11.6
* Debian 8 on desktop

Platforms with known issues:

* Low memory/cpu power embedded devices 

## Plugins

Devices are integrated through plugins in Droplit.io Edge. The currently integrated platforms through plugins are:

* Philips Hue ecosystem
* Belkin WeMo devices
* Sonos Wireless Speaker
* LIFX smart bulbs
* Venstar Voyager

More platforms will be integrated in the future, including a Raspberry Pi GPIO plugin, so stay tuned for that.

We do not currently support custom plugins, but will soon (typescript or javascript).

## About this repository

This repository is a multi-package typescript solution that contains several applications all built from one single build stream.


# Getting Started

The following documentation assumes you are using a Raspberry Pi 3 on Raspbian Lite 2016-05-27 (newer versions should suffice). It should also be similar to running the software on desktop/server environments.

## Environment configuration

Make sure your device is connected to the local network, we recommend a wired connection for best results.


Install Git to repo download source. 


For Rapsberry Pi:
```
sudo raspi-config
```
Go down to boot options and change it to "B2 Console Autologin"
This will make it so the user auto logins and then the edge server will start properly.

```
sudo apt-get install git
```

## Install Nodejs

The Nodejs Foundation provides arm6,7,8 builds of node. https://nodejs.org/en/download/current/

From the home directory (`cd ~`):
```
wget https://nodejs.org/dist/v6.4.0/node-v6.4.0-linux-arm64.tar.xz
tar -xvf node-v6.4.0-linux-arm64.tar.xz
cd node-v6.4.0-linux-arm64
sudo cp -R * /usr/local/
sudo chown -R `whoami` ~/.npm
sudo chown -R `whoami` /usr/local/lib/node_modules
sudo chown -R `whoami` /usr/local
cd ..
rm –rf node-v6.4.0-linux-arm64
rm node-v6.4.0-linux-arm64.tar.xz
```
This downloads, unpacks and installs NodeJs. It also fixes permission issures to allow for npm install without root permissions


To move NPM’s global install location see: https://docs.npmjs.com/getting-started/fixing-npm-permissions


## Install global NPM dependencies

run: `npm install -g ntypescript gulp typings`

## Downloading Droplit.io Edge

Using git:


run: `git clone https://github.com/droplit/droplit.io-edge.git --depth 1`

## Installing project dependencies

From the project root folder (`cd ~/droplit.io-edge`)


run: `npm install`


Then you can install all the node modules and link the dependent projects with a single command.


run: `gulp setup`


You only need to do this once. (unless the project dependency structure change)


## Local configuration 

You must supply the EcosystemID in order for the edge to link to your ecosystem.


Create a `localsettings.json` file by copying the `/projects/droplit-edge/localsettings.master.json` file.


Use this file to enable plugins and to supply your EcosystemID.


All plugins:
```
droplit-plugin-lifx,
droplit-plugin-philps-hue,
droplit-plugin-sonos,
droplit-plugin-wemo,
droplit-plugin-voyager
```

Go to the dev portal http://portal.droplit.io and copy your ecosystemId into the `ecosystemId` value in your `localsettings.json` file.


## Building

You can run a build with linting any time by running:


`gulp build`


If you want to build and continuously watch for changes, you can simply run:


`gulp watch`


## Debugging/Running

To observe debug output, prior to running:


(Unix / Linux) `export DEBUG=droplit:*`


(Windows)  `set DEBUG=droplit:*`


To run the application from the project root (`cd ~/droplit.io-edge`)


run:  `node droplit-edge`


## Cleanup or Reconfiguration


To undo the linked modules:


run: `gulp teardown`


If you need to change the project dependencies:
 - run `gulp teardown` 
 - then change the projects.json file
 - then run `gulp setup`.