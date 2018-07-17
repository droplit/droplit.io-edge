'use strict';

const argv = require('yargs').argv;
const gulp = require('gulp-help')(require('gulp'));
const async = require('async');
const del = require('del');
const merge = require('merge2');
const path = require('path');

// load gulp plugins
const jeditor = require('gulp-json-editor');
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
    try {
        exec(command, options, (error, stdout, stderr) => {
            console.log(`${path.resolve(options.cwd || '.')} ${chalk.cyan(command)}`);
            console.log(stdout);
            console.log(stderr);
            if (error !== null) {
                console.log('exec error: ', error);
            }
            callback();
        });
    } catch (ex) {
        console.log('rc ex', ex);
    }
}

/*
 * {cmd: "", cwd: ""}
 */
function runCommands(commands, parallel, callback) {
    if (parallel === true) {
        async.each(commands, (command, done) => {
            runCommand(command.cmd, { cwd: command.cwd }, done);
        }, () => {
            callback();
        });
    } else {
        async.eachSeries(commands, (command, done) => {
            runCommand(command.cmd, { cwd: command.cwd }, done);
        }, () => {
            callback();
        });
    }
}

// Setup

gulp.task('setup', 'Install all modules and link projects', callback => {
    G$.sequence('install', 'link', callback);
});

gulp.task('teardown', 'Clean all and unlink projects', callback => {
    G$.sequence('unlink', 'deepclean', callback);
});

// npm install

gulp.task('install', 'Install all npm modules', callback => {
    const commands = [];
    let packageNpmInstall = 'npm install';
    if (argv.optional === false) packageNpmInstall += ' --no-optional';
    if (argv.buildFromSource) packageNpmInstall += ' --build-from-source';
    if (argv.target_arch) packageNpmInstall += ` --target_arch=${argv.target_arch}`;
    projectNames.forEach(name => {
        commands.push({ cmd: packageNpmInstall, cwd: `projects/${name}` });
    });
    runCommands(commands, true, callback);
});

// npm link

gulp.task('link', 'Link dependencies on local disk', callback => {
    linker(true, callback);
});

gulp.task('unlink', 'Unlink dependencies on local disk', callback => {
    linker(false, callback);
});

function linker(mode, callback) {
    const linkCommands = [];
    const packageLinkCommands = [];
    projectNames.forEach(project => {
        linkCommands.push({ cmd: `npm ${mode ? 'link' : 'unlink'} --no-bin-links`, cwd: `projects/${project}` });
    });
    if (mode) {
        projectNames.forEach(project => {
            if (projects[project].dependencies) {
                projects[project].dependencies.forEach(dep => {
                    const packageName = require(`./projects/${dep}/package.json`).name;
                    packageLinkCommands.push({ cmd: `npm ${mode ? 'link' : 'unlink'} ${packageName} --no-bin-links`, cwd: `projects/${project}` });
                });
            }
        });
    }
    runCommands(linkCommands, true, () => {
        runCommands(packageLinkCommands, true, callback);
    });
    // info about "--no-bin-links" : see http://stackoverflow.com/questions/17990647/npm-install-errors-with-error-enoent-chmod
}

// Building

gulp.task('build', 'Compiles all TypeScript source files and updates module references', callback => {
    G$.sequence(['tslint', 'clean'], 'ts-all', callback);
});

gulp.task('watch', 'Contiuous build', ['build'], () => {
    projectNames.forEach(project => {
        gulp.watch(mapPaths(Array.prototype.concat(settings.tsfiles, settings.jsFiles), project), [`ts-${project}`]);
    });
});

// see https://www.npmjs.com/package/tslint
gulp.task('tslint', 'Lints all TypeScript source files', () =>
    gulp.src(wildcharPaths(settings.tsfiles))
        .pipe(G$.tslint({ formatter: 'verbose' }))
        .pipe(G$.tslint.report({ emitError: false }))
);

// Cleaning

gulp.task('clean', 'Cleans the generated files from lib directory', () =>
    del(expandPaths(settings.clean))
);

gulp.task('deepclean', 'Cleans the generated files from lib directory and all node_modules', () =>
    del(expandPaths(settings.deepClean))
);

// Transpiling
projectNames.forEach(project => {
    gulp.task(`ts-${project}`, `Transpile ${chalk.green(project)}`, () => {
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

gulp.task('ts-all', 'Transpile all projects', callback => {
    G$.sequence(projectNames.map(name => `ts-${name}`), callback);
});

// Extras

gulp.task('npm-i', `Install and save a ${chalk.cyan('pack')}age to a ${chalk.cyan('project')}`, callback => {
    const pack = argv.pack;
    const project = argv.project;
    runCommand(`npm install --save ${pack}`, { cwd: mapPath(settings.projectPath, project) }, () => {
        callback();
    });
}, {
    options: {
        pack: 'Package name',
        project: `Project name: ${chalk.green(projectNames.join(chalk.white(', ')))}`
    }
});

gulp.task('npm-u', `Uninstall and save a ${chalk.cyan('pack')}age to a ${chalk.cyan('project')}`, callback => {
    const pack = argv.pack;
    const project = argv.project;
    runCommand(`npm uninstall --save ${pack}`, { cwd: mapPath(settings.projectPath, project) }, () => {
        callback();
    });
}, {
    options: {
        pack: 'Package name',
        project: `Project name: ${chalk.green(projectNames.join(chalk.white(', ')))}`
    }
});

gulp.task('stats', 'Get lines of code', () => {
    const project = argv.project;
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

gulp.task('size', 'Get size of code', () => {
    const project = argv.project;
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

gulp.task('package', false, () => {
    const packageFileName = `${getPackageName(settings.edgeDir)}.tar`;
    return gulp.src(settings.packageFiles, { follow: true })
        .pipe(gulp.dest('dist/droplit-edge'))
        .pipe(G$.debug({ title: 'package:' }))
        .pipe(G$.tar(packageFileName))
        .pipe(G$.gzip())
        .pipe(gulp.dest('dist'));
});

gulp.task('clean-dist', false, () => del('dist'));

gulp.task('move-temp', false, () =>
    gulp.src(settings.edgeFiles, { follow: true })
        .pipe(gulp.dest('temp/droplit-edge'))
);

gulp.task('clean-temp', false, () => del('temp'));

gulp.task('setup-package', false, () =>
    gulp.src('./temp/droplit-edge/package.json')
        .pipe(jeditor(json => {
            const localConfig = require('./temp/droplit-edge/localsettings.json');
            if (Array.isArray(localConfig.plugins))
                localConfig.plugins.forEach(plugin => {
                    if (typeof plugin === 'string') {
                        json.dependencies[plugin] = `../../projects/${plugin}`;
                        return;
                    }

                    if (typeof plugin === 'object' && plugin.hasOwnProperty('name') && plugin.enabled !== false)
                        json.dependencies[plugin.name] = `../../projects/${plugin.name}`;
                });
            else
                Object.keys(localConfig.plugins).forEach(plugin => {
                    if (localConfig.plugins[plugin] && localConfig.plugins[plugin].enabled !== false) {
                        json.dependencies[plugin] = `../../projects/${plugin}`;
                    }
                });
            return json;
        }))
        .pipe(gulp.dest('temp/droplit-edge/'))
);

gulp.task('pre-install-dist', false, () => del('temp/droplit-edge/node_modules'));

gulp.task('install-dist', false, callback => {
    let npmInstall = 'npm install';
    if (argv.optional === false) npmInstall += ' --no-optional';
    if (argv.buildFromSource) npmInstall += ' --build-from-source';
    if (argv.target_arch) npmInstall += ` --target_arch=${argv.target_arch}`;
    runCommand(npmInstall, { cwd: 'temp/droplit-edge' }, () => {
        console.log('done');
        callback();
    });
});

gulp.task('build-dist', false, callback => {
    G$.sequence('clean-dist', 'build', 'unlink', 'move-temp', 'setup-package', 'pre-install-dist', 'install-dist', 'package', 'clean-temp', callback);
});

gulp.task('deploy', 'Glob the Droplit Edge for embedding', callback => {
    G$.sequence('setup', 'build-dist', callback);
});

// Testing for improving package
gulp.task('prep', false, () => del(expandPaths(settings.prep)));

// Version bump

const bumpOpts = {
    options: {
        major: 'when you make incompatible API changes',
        minor: 'when you add functionality in a backwards-compatible manner',
        patch: 'when you make backwards-compatible bug fixes',
        project: `Project name: ${chalk.green(projectNames.join(chalk.white(', ')))}`
    }
};

gulp.task('bump', 'Version bump a project.', () => {
    const major = argv.major;
    const minor = argv.minor;
    const patch = argv.patch;
    const project = argv.project;
    if (!project)
        return console.log(`${chalk.red('No project specified!')}`);

    const typeFlags = { 1: 'major', 2: 'minor', 4: 'patch' };
    const typeValue = (major << 0) + (minor << 1) + (patch << 2);
    const type = typeFlags[typeValue];
    if (!type)
        return console.log(`${chalk.red('Specify one version type to bump!')}`);

    const cwd = `projects/${project}/`;
    return gulp.src('./package.json', { cwd })
        .pipe(G$.bump({ type }))
        .pipe(gulp.dest('./', { cwd }));
}, bumpOpts);

gulp.task('debug', 'Debug droplit-edge', () => {
    const project = 'droplit-edge';
    G$.nodemon({
        script: `${project}.js`,
        ext: 'js',
        env: {
            DEBUG: 'droplit:*'
        },
        delay: 1, // Sec
        watch: `projects/${project}`,
        ignore: `projects/${project}/src`
    });
});

// .pipe(G$.plumber()) // exit gracefully if something fails after this


// gulp.task('test', 'Runs all tests', [], () => {
//     $.util.log(colors.cyan(`Testing ${settings.testGlob}`));

//     return gulp
//         .src(settings.testGlob, { read: true })
//         .pipe($.plumber()) // exit gracefully if something fails after this
//         .pipe($.mocha({ reporter: 'spec' }));
// });


// Attitional reference: https://github.com/johnpapa/gulp-patterns
// http://www.bennadel.com/blog/2169-where-does-node-js-and-require-look-for-modules.htm