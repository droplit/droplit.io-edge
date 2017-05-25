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
* Raspberry Pi GPIO

More platforms will be integrated in the future. PR's welcome.

## About this repository

This repository is a multi-package typescript solution that contains several applications all built from one single build stream.

# Getting Started

The following documentation assumes you are using a Raspberry Pi 3 on Raspbian Lite 2016-05-27 (newer versions should suffice). It should also be similar to running the software on desktop/server environments.

## Environment configuration

Make sure your device is connected to the local network, we recommend a wired connection for best results.


### Install Git 

```
sudo apt-get install git
```

### Install Nodejs

The Nodejs Foundation provides arm6,7,8 builds of node. [https://nodejs.org/en/download/current/](https://nodejs.org/en/download/current/)

For instructions on installing NodeJS, see [https://docs.droplit.io/docs/install-nodejs-on-linux](https://docs.droplit.io/docs/install-nodejs-on-linux)


### Install global NPM dependencies

run: 

```
npm install -g typescript gulp typings
```

## Downloading Droplit.io Edge

Using git:

run: 
```
git clone https://github.com/droplit/droplit.io-edge.git --depth 1
```

## Installing project dependencies

From the project root folder (`cd ~/droplit.io-edge`)


run: 
```
npm install
```

Then you can install all the node modules and link the dependent projects with a single command.


run: 
```
gulp setup
```


You only need to do this once. (unless the project dependency structure change)


## Local configuration 

You must supply the EcosystemID in order for the edge to link to your ecosystem.


Create a `localsettings.json` file by copying the `/projects/droplit-edge/localsettings.master.json` file.
```
cd /projects/droplit-edge/
cp localsettings.master.json localsettings.json
```

Use this file to enable plugins and to supply your EcosystemID.


All plugins:
```
droplit-plugin-lifx,
droplit-plugin-philps-hue,
droplit-plugin-sonos,
droplit-plugin-wemo,
droplit-plugin-voyager
droplit-plugin-gpio
```

Go to the dev portal [http://portal.droplit.io](http://portal.droplit.io) and copy your ecosystemId into the `ecosystemId` value in your `localsettings.json` file.


## Building

You can run a build with linting any time by running:

```
gulp build
```

> If you want to build and continuously watch for changes, you can simply run:
> `gulp watch`


## Debugging/Running

To observe debug output, prior to running:


(Unix / Linux) `export DEBUG=droplit:*`


(Windows)  `set DEBUG=droplit:*`


To run the application from the project root (`cd ~/droplit.io-edge`)


run:  
```
node droplit-edge
```

## Cleanup or Reconfiguration


To undo the linked modules:


run: `gulp teardown`


If you need to change the project dependencies:
 - run `gulp teardown` 
 - then change the projects.json file
 - then run `gulp setup`.