```
 _| _ _  _ |.|_   . _  
(_|| (_)|_)|||_.o |(_) 
        |             
```
# Droplit.io Edge Solution

This repository is a mult-package solution that contians several applications all built from one single build stream.

## Getting Started

To use this solution, make sure you have some things installed globally:

run: `npm install -g ntypescript gulp typings`

Also make sure that the local dev dependencies are installed

run: `npm install`

Then you can install all the node modules and link the dependant projects with a single command.

run: `gulp setup`

You only need to do this once. (unless the project dependency structure change)

## Building

You can run a build with linting any time by running:

`gulp build`

If you want to build and continuously watch for changes, you can simply run:

`gulp watch`

## Debugging/Running

To observe debug output (Windows) `set DEBUG=droplit:*` prior to running.

To run any single CLI application, run `node app_name` where app_name is the name of the CLI app.

Ex: `node droplit-edge`

## Cleanup or Reconfiguration

To undo the linked modules, close VS code and...

run: `gulp teardown`

If you need to change the project dependencies:
 - run `gulp teardown` 
 - then change the projects.json file
 - then run `gulp setup`.

## Configuring the Edge

 > IMPORTANT! You must supply the EcosystemID in order for the edge to link to your ecosystem.

Create a `localsettings.json` file by copying the `/projects/droplit-edge/localsettings.master.json` file.

Use this file to enable plugins and to supply your EcosystemID.

Go to the dev portal http://portal.droplit.io and copy your ecosystemId into the `ecosystemId` value in your `localsettings.json` file.

#Raspberry Pi

## Installing Node and NPM
The Nodejs Foundation provides arm6,7,8 builds of node. https://nodejs.org/en/download/current/

For Node v4.0.0
```
wget https://nodejs.org/dist/v4.0.0/node-v4.0.0-linux-armv6l.tar.gz 
tar -xvf node-v4.0.0-linux-armv6l.tar.gz 
cd node-v4.0.0-linux-armv6l
sudo cp -R * /usr/local/
```

https://blog.wia.io/installing-node-js-v4-0-0-on-a-raspberry-pi


Fixing access denied
```
sudo chown -R `whoami` ~/.npm
sudo chown -R `whoami` /usr/local/lib/node_modules
sudo chown -R `whoami` /usr/local
```

Nodejs compiled arm binaries provided by NodeSource https://github.com/nodesource/distributions
``` 
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
```

```
sudo apt-get install -y nodejs
```


Moving npm global install location: https://docs.npmjs.com/getting-started/fixing-npm-permissions

```
mkdir /npm
mkdir /npm/cache
npm config set prefix /npm
npm config set cache /npm/cache
export PATH="/npm/bin:$PATH"
```