var debug = require('debug');
var log =  debug('hub:update');
var path = require('path');
var Download = require('download');
var Decompress = require('decompress');
var installer = require('strong-service-install');

exports.doUpdate = function (packageName, url) {
	exports.download(packageName, url,
        function(result) {
            if (result.success) {
                console.log('update extracted to', result.installPath);
                exports.install(result.installPath);
            } else {
                console.log('update download failed');
            }
        });
}

exports.download = function (packageName, url, callback) {
	var packageDir = getPacakgePath();
	log('downloading', packageName, '\nfrom', url, '\nto', packageDir);
	new Download({mode: '755'}) //, extract: true
		.get(url)
		.dest(packageDir)
		.rename(packageName)
		.run(function(err, files) {
			if (err) {
				log('download error', err);
				if (callback) callback({success: false});
			} else {
				var file = path.join(packageDir, packageName);
				var outPath = path.join(packageDir, path.basename(packageName, '.tar.gz'));
				log('extracting', file, ' to', outPath);
				new Decompress({mode: '755'})
					.src(file)
					.dest(outPath)
					.use(Decompress.targz({strip: 1}))
					.run(function (err1, files1) {
						if (err1) {
							log('extraction error', err1);
							if (callback) callback({success: false}); 
						} else {
							log('extraction complete');
							if (callback) callback({installPath: outPath, success: true});
						}
					});
			}
		});
}

function getPacakgePath() {
	// var packagePath = path.normalize(__dirname + '/../' + subDir);
	// return packagePath;
	return path.resolve(global.config.localStorage.downloadPath);
}

function getThisPacakgePath() {
	var packagePath = path.normalize(__dirname);
	return packagePath;
}

exports.install = function (packagePath) {
	var restart = true;
	if (packagePath == undefined) {
		packagePath = getThisPacakgePath();
		restart = false;
	}
	console.log("Installing", packagePath);
	var pack = require(path.join(packagePath, 'package.json'));
	var opts = {
			name: 'droplit',
			author: pack.author,
			description: pack.description,
			user: process.env.USER,
			command: 'sudo node app.js',
			cwd: packagePath,
			systemd: true,
			force: true
		};
	installer(opts, function(err, result) {
			if (err) {
				console.error('Failed to install service:', err.message);
				//process.exit(1);
			} else {
				console.log('Successfully installed service:', result);
				if (restart) {
					setTimeout(reloadService, 500);
				}
				//process.exit(0);
			}
		});
}

exports.restartService = restartService;
exports.rebootSystem = rebootSystem;
exports.shutdownSystem = shutdownSystem;

var exec = require('child_process').exec;

function runCommand(command, callback) {
    console.log('running command:', command);
    exec(command, function (error, stdout, stderr) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		if (error !== null) {
			console.log('exec error: ' + error);
		}
        callback(error == null);
	});
}

function reloadService() {
    runCommand('sudo systemctl daemon-reload', function() {
        setTimeout(function() {
			restartService();
		}, 1000);
    });
}

function restartService() {
    runCommand('sudo service droplit restart', function(success) {
        if (success) {
            process.exit(0);
        }
    });
}

function rebootSystem() {
    runCommand('sudo reboot', function() {
        // nop
    });
}

function shutdownSystem() {
    runCommand('sudo poweroff', function() {
        // nop
    });
}

// function restartService() {
// 	var exec = require('child_process').exec;
// 	console.log('sudo systemctl daemon-reload');
// 	exec('sudo systemctl daemon-reload', function (error, stdout, stderr) {
// 		console.log('stdout: ' + stdout);
// 		console.log('stderr: ' + stderr);
// 		if (error !== null) {
// 			console.log('exec error: ' + error);
// 		}
// 		setTimeout(function() {
// 			console.log('sudo service droplit restart');
// 			exec('sudo service droplit restart', function (error, stdout, stderr) {
// 				console.log('stdout: ' + stdout);
// 				console.log('stderr: ' + stderr);
// 				if (error !== null) {
// 					console.log('exec error: ' + error);
// 				} else {
//                     process.exit(0);
//                 }
// 			});
// 		}, 1000);
// 	});
// }

// just to test
// global.config = require('./config.json');
// exports.download(
// 	'droplithub0.0.2.tar.gz', 
// 	'https://droplitdeploy.blob.core.windows.net/hubpub/droplithub0.0.2.tar.gz?sv=2014-02-14&sr=c&sig=k9YJMsO4xWc%2BnMOqmlYMjEFnlbIWdQjW0fVtT1gENxA%3D&st=2015-09-30T04%3A00%3A00Z&se=2015-10-08T04%3A00%3A00Z&sp=r',
// 	function(result) {
// 		console.log('extracted to', result.installPath);
// 		exports.install(result.installPath)
// 	});

// test install
//exports.install('/home/pi/droplithub0.0.2');