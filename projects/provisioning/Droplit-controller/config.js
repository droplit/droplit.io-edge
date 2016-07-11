var util = require('util');
var commander = require('commander');
var fsUtil = require('droplit-cli-common').fsUtil;

commander
	.command('host [host]')
	.usage('[host]')
	.action(function(host) {
		var config = require('./config.json');
		var settings = fsUtil.readSettings();
		if (host && host.length > 0 && fsUtil.validValue(config[host])) {
	        console.log(util.format('\nselected host = %s (%s)', host, config[host].server.url));
	        var success = fsUtil.updateSetting('host', host);
	        if (success) {
	            console.log('\nHost selected and saved');
	        } else {
	            console.log('\nError saving host selection');
	        }
	    } else {
			var host = fsUtil.validValue(settings.host) ? settings.host : config.host;
	        console.log(util.format('\nselected host = %s (%s)', host, config[host].server.url));
	    }
	});
	
commander
	.command('install')
	.action(function() {
		var update = require('./update');
		update.install();
	});
	

commander
	.command('update-disable')
	.action(function() {
		var success = fsUtil.updateSetting('update', false);
		if (success) {
			console.log('\nAutomatic updating disabled\n');
		} else {
			console.log('\nError saving update setting\n');
		}
	});
	
commander
	.command('update-enable')
	.action(function() {
		var success = fsUtil.updateSetting('update', true);
		if (success) {
			console.log('\nAutomatic updating enabled\n');
		} else {
			console.log('\nError saving update setting\n');
		}
	});
	
commander
	.command('update-status')
	.action(function() {
		var settings = fsUtil.readSettings();
		var value = settings['update'];
		if (value == undefined) value = true;
		console.log('\nAutomatic updates:', value, '\n');
	});
	
commander
	.command('reset-settings')
	.action(function() {
		// delete settings file
		var fsUtil = require('droplit-cli-common').fsUtil;
		var userSettingsPath = fsUtil.droplitDir() + '/settings.json';
		var fs = require('fs');
		fs.unlink(userSettingsPath);
		// TODO: remove wifi settings
	});

commander.parse(process.argv);
