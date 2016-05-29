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

To undo the linked modules, close VS code and...

run: `gulp teardown`

If you need to change the project dependencies run `gulp teardown` then change the projects.json file, then run `gulp setup`.

## Building

You can run a build with linting any time by running:

`gulp build`

If you want to build and continuously watch for changes, you can simply run:

`gulp watch`

## Debugging

To observe debug output (Windows) `set DEBUG=droplit:*` prior to running.

To run any single CLI application, run `node app_name` where app_name is the name of the CLI app.

Ex: `node droplit-edge`
