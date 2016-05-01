'use strict';

var gulp = require('gulp-help')(require('gulp-param')(require('gulp'), process.argv));
var spawn = require('child_process').spawn;
var async = require('async');
var del = require('del');
var merge = require('merge2');
var path = require('path');

// load gulp plugins
const G$ = require('gulp-load-plugins')({ lazy: true });
const chalk = G$.util.colors;

// constants
var PROJECT_VAR = '{project}';

// load settings
var settings = require('./gulp.json');
var tsconfig = require('./tsconfig.master.json');
var projects = require('./projects.json');
var projectNames = Object.keys(projects);
// console.log(settings);
var projectPaths = projectNames.map(project => { return settings.projectPath.replace(PROJECT_VAR, project); });

function expandPaths(globArray) {
    var expandedGlob = [];
    globArray.forEach((item) => {
        if (item.indexOf(PROJECT_VAR) > 0) {
            projectNames.forEach((project) => {
                expandedGlob.push(item.replace(PROJECT_VAR, project));
            });
        } else {
            expandedGlob.push(item);
        }
    });
    return expandedGlob;
}

function wildcharPaths(globArray) {
    var expandedGlob = [];
    globArray.forEach((item) => {
        if (item.indexOf(PROJECT_VAR) > 0) {
            expandedGlob.push(item.replace(PROJECT_VAR, '*'));
        } else {
            expandedGlob.push(item);
        }
    });
    return expandedGlob;
}

function mapPaths(globArray, project) {
    return globArray.map((path) => {
        return mapPath(path, project);
    });
}

function mapPath(path, project) {
    return path.replace(PROJECT_VAR, project);
}

function plumberErrorHandler(err) {
    console.log(err.stack);
    this.emit('end'); // For gulp watch
}

var exec = require('child_process').exec;
function runCommand(command, options, callback) {
    exec(command, options, function (error, stdout, stderr) {
        console.log(`${path.resolve(options.cwd || '.')} ${command}`);
		console.log(stdout);
		console.log(stderr);
		if (error !== null) {
			console.log('exec error: ' + error);
		}
        // callback(error == null);
        callback();
	});
}

/**
 * {cmd: "", cwd: ""}
 */
function runCommands(commands, callback) {
    async.eachSeries(commands, function(command, done) {
        runCommand(command.cmd, {cwd: command.cwd}, done);
    }, function(err) {
        callback();
    });
}

// Setup

gulp.task('setup', 'Install all modules and link projects', function(callback) {
    G$.sequence('install', 'link', callback);
});

gulp.task('teardown', 'Clean all and unlink projects', function(callback) {
    G$.sequence('unlink', 'deepclean', callback);
});

// npm install

gulp.task('install', 'Install all npm modules', function(callback) {
    var commands = [];
    commands.push({cmd:'npm install', cwd: undefined});
    projectNames.forEach((name) => {
        commands.push({cmd:'npm install', cwd: `projects/${name}`});
    });
    runCommands(commands, callback);
});

// npm link

gulp.task('link', 'Link dependencies on local disk', function(callback) {
    linker(true, callback);
});

gulp.task('unlink', 'Unlink dependencies on local disk', function(callback) {
    linker(false, callback);
});

function linker(mode, callback) {
    var linkedDeps = {};
    var commands = [];
    projectNames.forEach((proj) => {
        if (projects[proj].dependencies) {
            projects[proj].dependencies.forEach((dep) => {
                if (!linkedDeps[dep]) {
                    commands.push({cmd:`npm ${mode ? 'link' : 'unlink'} --no-bin-links`, cwd: `projects/${dep}`});
                    linkedDeps[dep] = true;
                }
                if (mode) {
                    var packageName = require(`./projects/${dep}/package.json`).name;
                    commands.push({cmd: `npm ${mode ? 'link' : 'unlink'} ${packageName} --no-bin-links`, cwd: `projects/${proj}`});
                }
            });
        }
    });
    runCommands(commands, callback);
    // info about "--no-bin-links" : see http://stackoverflow.com/questions/17990647/npm-install-errors-with-error-enoent-chmod
}

// Building

gulp.task('build', 'Compiles all TypeScript source files and updates module references', function (callback) {
    G$.sequence(['tslint', 'clean'], 'ts-all', callback);
});

gulp.task('watch', 'Contiuous build', ['build'], function() {
    projectNames.forEach((project) => {
        gulp.watch(mapPaths(settings.tsfiles, project), [`ts-${project}`]);
    });
});

// see https://www.npmjs.com/package/tslint
gulp.task('tslint', 'Lints all TypeScript source files', function () {
    return gulp.src(wildcharPaths(settings.tsfiles))
        .pipe(G$.tslint())
        .pipe(G$.tslint.report('verbose'));
});

// Cleaning

gulp.task('clean', 'Cleans the generated files from lib directory', function () {
    return del(expandPaths(settings.clean));
});

gulp.task('deepclean', 'Cleans the generated files from lib directory and all node_modules', function () {
    return del(expandPaths(settings.deepClean));
});

// Transpiling

var tsProjects = {};
projectNames.forEach((project) => {
    tsProjects[project] = G$.typescript.createProject(tsconfig.compilerOptions);
    gulp.task(`ts-${project}`, `Transpile ${chalk.green(project)}`, function() {
        var tsResult = gulp.src(mapPaths(settings.tsfiles, project))
            .pipe(G$.sourcemaps.init())
            .pipe(G$.typescript(tsProjects[project]));
        var dest = mapPath(settings.dest, project);
        return merge([
            tsResult.dts.pipe(gulp.dest(dest)),
            tsResult.js
                .pipe(G$.sourcemaps.write()) // inline sourcemaps
                // .pipe(G$.sourcemaps.write('.')) // separate .js.map files
                .pipe(gulp.dest(dest))
        ]);
    });
});

// var tsProject = G$.typescript.createProject(tsconfig.compilerOptions);
gulp.task('ts-all', 'Transpile all projects', function(callback) {
    G$.sequence(projectNames.map((name) => {return `ts-${name}`}), callback);
});

// Extras

gulp.task('npm-i', `Install and save a ${chalk.cyan('pack')}age to a ${chalk.cyan('project')}`, function(project, pack, callback) {
    runCommand(`npm install --save ${pack}`, {cwd: mapPath(settings.projectPath, project)}, function() {
        callback();
    });
}, {
        options: {
            'pack': "Package name",
            'project': "Project name: " + chalk.green(projectNames.join(chalk.white(', ')))
        }
});

gulp.task('npm-u', `Uninstall and save a ${chalk.cyan('pack')}age to a ${chalk.cyan('project')}`, function(project, pack, callback) {
    runCommand(`npm uninstall --save ${pack}`, {cwd: mapPath(settings.projectPath, project)}, function() {
        callback();
    });
}, {
        options: {
            'pack': "Package name",
            'project': "Project name: " + chalk.green(projectNames.join(chalk.white(', ')))
        }
});

gulp.task('stats', 'Get lines of code', function(project) {
    console.log(project);
    if (project) {
        console.log('Source Lines of Code:', chalk.green(project));
        gulp.src(mapPaths(settings.sloc_project, project)).pipe(G$.sloc({tolerant:true}));
    } else {
        console.log('Source Lines of Code:' + chalk.white('ALL'));
        gulp.src(settings.sloc_all).pipe(G$.sloc({tolerant:true}));
    }
}, {
        options: {
            'project': "Project name: " + chalk.green(projectNames.join(chalk.white(', ')))
        }
});

// .pipe(G$.plumber()) // exit gracefully if something fails after this


// gulp.task('test', 'Runs all tests', [], function () {
//     $.util.log(colors.cyan(`Testing ${settings.testGlob}`));

//     return gulp
//         .src(settings.testGlob, { read: true })
//         .pipe($.plumber()) // exit gracefully if something fails after this
//         .pipe($.mocha({ reporter: 'spec' }));
// });


// Attitional reference: https://github.com/johnpapa/gulp-patterns
// http://www.bennadel.com/blog/2169-where-does-node-js-and-require-look-for-modules.htm