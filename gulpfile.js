'use strict';

/* eslint-disable prefer-arrow-callback */
/* TODO: Use arrow-functions for tasks once gulp-param fixes bug that causes them not to work */

const gulp = require('gulp-help')(require('gulp-param')(require('gulp'), process.argv));
const async = require('async');
const del = require('del');
const merge = require('merge2');
const path = require('path');

// load gulp plugins
const G$ = require('gulp-load-plugins')({ lazy: true });
const chalk = G$.util.colors;

// constants
const PROJECT_VAR = '{project}';

// load settings
const settings = require('./gulp.json');
const tsconfig = require('./tsconfig.master.json');
const projects = require('./projects.json');
const projectNames = Object.keys(projects);

function expandPaths(globArray) {
    const expandedGlob = [];
    globArray.forEach(item => {
        if (item.indexOf(PROJECT_VAR) > 0) {
            projectNames.forEach(project => {
                expandedGlob.push(item.replace(PROJECT_VAR, project));
            });
        } else {
            expandedGlob.push(item);
        }
    });
    return expandedGlob;
}

function wildcharPaths(globArray) {
    const expandedGlob = [];
    globArray.forEach(item => {
        if (item.indexOf(PROJECT_VAR) > 0) {
            expandedGlob.push(item.replace(PROJECT_VAR, '*'));
        } else {
            expandedGlob.push(item);
        }
    });
    return expandedGlob;
}

function mapPaths(globArray, project) {
    return globArray.map(path =>
        mapPath(path, project));
}

function mapPath(path, project) {
    return path.replace(PROJECT_VAR, project);
}

function plumberErrorHandler(err) {
    console.log(err.stack);
    this.emit('end'); // For gulp watch
}

const exec = require('child_process').exec;
function runCommand(command, options, callback) {
    exec(command, options, function (error, stdout, stderr) {
        console.log(`${path.resolve(options.cwd || '.')} ${command}`);
        console.log(stdout);
        console.log(stderr);
        if (error !== null) {
            console.log('exec error: ', error);
        }
        callback();
    });
}

/**
 * {cmd: "", cwd: ""}
 */
function runCommands(commands, callback) {
    async.eachSeries(commands, function (command, done) {
        runCommand(command.cmd, { cwd: command.cwd }, done);
    }, function () {
        callback();
    });
}

// Setup

gulp.task('setup', 'Install all modules and link projects', function (callback) {
    G$.sequence('install', 'link', callback);
});

gulp.task('teardown', 'Clean all and unlink projects', function (callback) {
    G$.sequence('unlink', 'deepclean', callback);
});

// npm install

gulp.task('install', 'Install all npm modules', function (callback) {
    const commands = [];
    commands.push({ cmd: 'npm install', cwd: undefined });
    projectNames.forEach(name => {
        commands.push({ cmd: 'npm install', cwd: `projects/${name}` });
    });
    runCommands(commands, callback);
});

// npm link

gulp.task('link', 'Link dependencies on local disk', function (callback) {
    linker(true, callback);
});

gulp.task('unlink', 'Unlink dependencies on local disk', function (callback) {
    linker(false, callback);
});

function linker(mode, callback) {
    const linkedDeps = {};
    const commands = [];
    projectNames.forEach(proj => {
        if (projects[proj].dependencies) {
            projects[proj].dependencies.forEach(dep => {
                if (!linkedDeps[dep]) {
                    commands.push({ cmd: `npm ${mode ? 'link' : 'unlink'} --no-bin-links`, cwd: `projects/${dep}` });
                    linkedDeps[dep] = true;
                }
                if (mode) {
                    const packageName = require(`./projects/${dep}/package.json`).name;
                    commands.push({ cmd: `npm ${mode ? 'link' : 'unlink'} ${packageName} --no-bin-links`, cwd: `projects/${proj}` });
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

gulp.task('watch', 'Contiuous build', ['build'], function () {
    projectNames.forEach(project => {
        gulp.watch(mapPaths(settings.tsfiles, project), [`ts-${project}`]);
    });
});

// see https://www.npmjs.com/package/tslint
gulp.task('tslint', 'Lints all TypeScript source files', function () {
    return gulp.src(wildcharPaths(settings.tsfiles))
        .pipe(G$.tslint({ formatter: 'verbose' }))
        .pipe(G$.tslint.report());
});

// Cleaning

gulp.task('clean', 'Cleans the generated files from lib directory', function () {
    return del(expandPaths(settings.clean));
});

gulp.task('deepclean', 'Cleans the generated files from lib directory and all node_modules', function () {
    return del(expandPaths(settings.deepClean));
});

// Transpiling
projectNames.forEach(project => {
    gulp.task(`ts-${project}`, `Transpile ${chalk.green(project)}`, function () {
        const tsResult = gulp.src(mapPaths(settings.tsfiles, project))
            .pipe(G$.sourcemaps.init())
            .pipe(G$.typescript.createProject(tsconfig.compilerOptions)());
        const dest = mapPath(settings.dest, project);
        return merge([
            tsResult.dts.pipe(gulp.dest(dest)),
            tsResult.js
                .pipe(G$.sourcemaps.write('.')) // separate .js.map files
                .pipe(gulp.dest(dest)),
            // JS files
            gulp.src(mapPaths(settings.jsFiles, project)).pipe(G$.babel({
                presets: ['es2015']
            })).pipe(gulp.dest(dest)),
            // all other files
            gulp.src(mapPaths(settings.resources, project)).pipe(gulp.dest(dest))
        ]);
    });
});

gulp.task('ts-all', 'Transpile all projects', function (callback) {
    G$.sequence(projectNames.map(name => `ts-${name}`), callback);
});

// Extras

gulp.task('npm-i', `Install and save a ${chalk.cyan('pack')}age to a ${chalk.cyan('project')}`, function (project, pack, callback) {
    runCommand(`npm install --save ${pack}`, { cwd: mapPath(settings.projectPath, project) }, function () {
        callback();
    });
}, {
        options: {
            pack: 'Package name',
            project: `Project name: ${chalk.green(projectNames.join(chalk.white(', ')))}`
        }
    });

gulp.task('npm-u', `Uninstall and save a ${chalk.cyan('pack')}age to a ${chalk.cyan('project')}`, function (project, pack, callback) {
    runCommand(`npm uninstall --save ${pack}`, { cwd: mapPath(settings.projectPath, project) }, function () {
        callback();
    });
}, {
        options: {
            pack: 'Package name',
            project: `Project name: ${chalk.green(projectNames.join(chalk.white(', ')))}`
        }
    });

gulp.task('stats', 'Get lines of code', function (project) {
    console.log(project);
    if (project) {
        console.log(`Source Lines of Code: ${chalk.green(project)}`);
        gulp.src(mapPaths(settings.sloc_project, project)).pipe(G$.sloc({ tolerant: true }));
    } else {
        console.log(`Source Lines of Code: ${chalk.white('ALL')}`);
        gulp.src(settings.sloc_all).pipe(G$.sloc({ tolerant: true }));
    }
}, {
        options: {
            project: `Project name: ${chalk.green(projectNames.join(chalk.white(', ')))}`
        }
    });

gulp.task('size', 'Get size of code', function (project) {
    console.log(project);
    if (project) {
        console.log(`Source Lines of Code: ${chalk.green(project)}`);
        gulp.src(mapPaths(settings.runtimeFiles, project)).pipe(G$.size({ showFiles: true }));
    } else {
        console.log(`Source Lines of Code: ${chalk.white('ALL')}`);
        gulp.src(expandPaths(settings.runtimeFiles)).pipe(G$.size({ showFiles: true }));
    }
}, {
        options: {
            project: `Project name: ${chalk.green(projectNames.join(chalk.white(', ')))}`
        }
    });

// Deploying

function getPackageName(packagePath) {
    const packageFile = require(path.join(path.resolve(packagePath), 'package.json'));
    return `${packageFile.name}_${packageFile.version}`;
}

gulp.task('package', 'Package the Droplit Edge for embedding', function () {
    const packageFileName = `${getPackageName(settings.edgeDir)}.tar`;
    gulp.src(settings.packageFiles, { follow: true })
        .pipe(G$.debug({ title: 'package:' }))
        .pipe(G$.tar(packageFileName))
        .pipe(G$.gzip())
        .pipe(gulp.dest('dist'));
});

gulp.task('clean-dist', 'Clean dist', function () {
    return del('dist');
});

gulp.task('deploy', 'Glob the Droplit Edge for embedding', ['clean-dist'], function () {
    return gulp.src(settings.packageFiles, { follow: true })
        .pipe(gulp.dest('dist'));
});

// Testing for improving package
gulp.task('prep', false, function () {
    return del(expandPaths(settings.prep));
});

// Version bump

const bumpOpts = {
    options: {
        major: `when you make incompatible API changes`,
        minor: `when you add functionality in a backwards-compatible manner`,
        patch: `when you make backwards-compatible bug fixes`,
        project: `Project name: ${chalk.green(projectNames.join(chalk.white(', ')))}`
    }
};

gulp.task('bump', 'Version bump a project.', function (major, minor, patch, project) {
    if (!project) return console.log(`${chalk.red('No project specified!')}`);
    let type = '';
    if (major && !minor && !patch) type = 'major';
    if (!major && minor && !patch) type = 'minor';
    if (!major && !minor && patch) type = 'patch';
    if (!type) return console.log(`${chalk.red('Specify one version type to bump!')}`);
    const cwd = 'projects/project/';
    return gulp.src('./package.json', { cwd })
        .pipe(G$.bump({ type }))
        .pipe(gulp.dest('./', { cwd }));
}, bumpOpts);

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