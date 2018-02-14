#! /usr/bin/env node

//droplit.io-edge/bin
const fs = require('fs');
const path = require('path');
const DROPLIT_ROOT = '.droplit.io';
const LOCAL_SETTINGS = 'localsettings.json';
var command = process.argv[2];

//commands
if (command == "-h" || command == "--help") {
    help();
} else if (command == "-e" || command == "--ecosystemId") {
    ecosystemId(process.argv[3]);
} else {
    console.log("invalid command");
}

//-h --help
function help() {
    console.log("-h --help");
    console.log("-e --ecosystemId");
    return;
}

//-e --ecosystemId
function ecosystemId(inputId) {
    var localDir = path.join('projects', 'droplit-edge', LOCAL_SETTINGS);
    if (!inputId) {
        console.log("Please specify an ecosystemId");
        /*        fs.exists(localDir, function (exists) {
                    if (exists) {
                        //console.log('edge will be run from local file');
                        return;
                    } else {
                        fs.exists(path.join(droplitDir() , LOCAL_SETTINGS), function (exists) {
                            if (exists) {
                                //console.log('edge will be run from user file');
                                return;
                            } else {
                                console.log('Please specify an ecosystemId');
                                return;
                            }
                        });
                    }
                });
                */
        return;
    } else if (inputId.length == 25) {
        var file = JSON.parse(fs.readFileSync(path.join('projects', 'droplit-edge', 'localsettings.master.json')).toString());
        file.ecosystemId = inputId;

        fs.writeFile(path.join(droplitDir(), LOCAL_SETTINGS), JSON.stringify(file, null, 2), function (err) {
            console.log("ecosystemId updated \n" + path.join(droplitDir(), LOCAL_SETTINGS));
            return;
        });
    } else {
        console.log("invalid ID");
        return;
    }
}

function droplitDir() {
    var homeFolder = false;
    if (process.env.HOME !== undefined) {
        homeFolder = path.join(process.env.HOME, DROPLIT_ROOT);
    }
    if (process.env.HOMEDRIVE && process.env.HOMEPATH) {
        homeFolder = path.join(process.env.HOMEDRIVE, process.env.HOMEPATH, DROPLIT_ROOT);
    }
    if (!homeFolder) {
        fs.mkdirSync(homeFolder, 502); // 0766
    }
    return homeFolder;
}




