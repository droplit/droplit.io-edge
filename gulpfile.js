const gulp = require('gulp');
const parameterized = require('gulp-parameterized');

const colors = require('ansi-colors');
const del = require('del');
const { exec } = require('child_process');
const merge = require('merge2');
const path = require('path');

const G$ = require('gulp-load-plugins')({ lazy: true });
const jeditor = require('gulp-json-editor');

const projects = require('./projects.json');
const projectNames = Object.keys(projects);
const settings = require('./gulp.json');
const tsconfig = require('./tsconfig.master.json');

const PROJECT_VAR = '{project}';

/* npm install */
const install = done => {
    gulp.parallel(
        [undefined].concat(...projectNames)
            .map(command => {
                const run = cb =>
                    runCommand('npm install', { cwd: command ? `projects/${command}` : undefined }, cb);
                run.displayName = `install-${command || 'root'}`;
                return run;
            })
    )(done);
};

/* npm link */
const link = done => { linker(true, done); };

const unlink = done => { linker(false, done); };

const linker = (mode, done) => {
    const projectLinks = projectNames.map(project => {
        const linkPhrase = mode ? 'link' : 'unlink';
        const run = cb =>
            runCommand(`npm ${linkPhrase} --no-bin-links`, { cwd: `projects/${project}` }, cb);
        run.displayName = `${linkPhrase}-${project}`;
        return run;
    });

    const tasks = [gulp.parallel(projectLinks)];
    if (mode) {
        const dependencyLinks = projectNames
            .filter(p => projects[p].hasOwnProperty('dependencies'))
            .reduce((p, c) =>
                p.concat(...projects[c].dependencies.map(dependency => {
                    const { name } = require(`./projects/${dependency}/package.json`); // eslint-disable-line global-require
                    const run = cb =>
                        runCommand(`npm link ${name} --no-bin-links`, { cwd: `projects/${c}` }, cb);
                    run.displayName = `link:${name}->${c}`;
                    return run;
                })), []
            );
        if (dependencyLinks.length > 0)
            tasks.push(dependencyLinks);
    }

    gulp.series(tasks)(done);
};

/* Cleaning */
const clean = () => del(expandGlobs(settings.clean));

const deepClean = () => del(expandGlobs(settings.deepClean));

/* Building */
const tslint = () =>
    gulp.src(wildcardPaths(settings.tsfiles))
        .pipe(G$.tslint({ formatter: 'verbose' }))
        .pipe(G$.tslint.report({ emitError: false }));

/* Transpiling */
const tsProjects = {};
projectNames.forEach(project => {
    const tsProj = () => {
        const tsResult = gulp.src(mapPaths(settings.tsfiles, project))
            .pipe(G$.sourcemaps.init())
            .pipe(G$.typescript.createProject(tsconfig.compilerOptions)());
        const dest = mapPath(settings.dest, project);
        return merge([
            tsResult.dts.pipe(gulp.dest(dest)),
            tsResult.js // separate .js.map files
                .pipe(G$.sourcemaps.write('.'))
                .pipe(gulp.dest(dest)),
            // JS files
            gulp.src(mapPaths(settings.jsFiles, project))
                .pipe(G$.babel({ presets: ['es2015'] }))
                .pipe(gulp.dest(dest)),
            // all other files
            gulp.src(mapPaths(settings.resources, project)).pipe(gulp.dest(dest))
        ]);
    };
    tsProjects[project] = tsProj;
});

const watch = () => {
    projectNames.forEach(project =>
        gulp.watch(mapPaths(Array.prototype.concat(settings.tsfiles, settings.jsFiles), project), gulp.parallel(`ts-${project}`)));
};

/* Debug */
const debug = () => {
    const project = 'droplit-edge';
    G$.nodemon({
        script: `${project}.js`,
        ext: 'js',
        env: { DEBUG: 'droplit:*' },
        delay: 1, // Sec
        watch: `projects/${project}`,
        ignore: `projects/${project}/src`
    });
};

/* Dependencies */
const npmInstall = (done, params) => {
    if (!params.pack || !params.project) {
        console.error('Must specify a package and project');
        return done();
    }

    runCommand(`npm install --save ${params.pack}`, { cwd: mapPath(settings.projectPath, params.project) }, done);
};

const npmUninstall = (done, params) => {
    if (!params.pack || !params.project) {
        console.error('Must specify a package and project');
        return done();
    }

    runCommand(`npm uninstall --save ${params.pack}`, { cwd: mapPath(settings.projectPath, params.project) }, done);
};

/* Code analysis */
const stats = (done, params) => {
    if (params.project) {
        console.log(`Source Lines of Code: ${colors.green(params.project)}`);
        return gulp.src(mapPaths(settings.sloc_project, params.project)).pipe(G$.sloc({ tolerant: true }));
    }

    console.log(`Source Lines of Code: ${colors.white('ALL')}`);
    return gulp.src(settings.sloc_all).pipe(G$.sloc({ tolerant: true }));
};

const size = (done, params) => {
    if (params.project) {
        console.log(`Source Lines of Code: ${colors.green(params.project)}`);
        return gulp.src(mapPaths(settings.runtimeFiles, params.project)).pipe(G$.size({ showFiles: true }));
    }

    console.log(`Source Lines of Code: ${colors.white('ALL')}`);
    return gulp.src(expandGlobs(settings.runtimeFiles)).pipe(G$.size({ showFiles: true }));
};

/* Deployment */
const cleanDist = () => del('dist');

const moveTemp = () =>
    gulp.src(settings.edgeFiles, { follow: true })
        .pipe(gulp.dest('temp/droplit-edge'));

const setupPackage = () =>
    gulp.src('./temp/droplit-edge/package.json')
        .pipe(jeditor(json => {
            const localConfig = require('./temp/droplit-edge/localsettings.json'); // eslint-disable-line global-require
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
                Object.keys(localConfig.plugins)
                    .filter(plugin => localConfig.plugins[plugin] && localConfig.plugins[plugin].enabled !== false)
                    .forEach(plugin => (json.dependencies[plugin] = `../../projects/${plugin}`));

            return json;
        }))
        .pipe(gulp.dest('temp/droplit-edge/'));

const preInstallDist = () => del('temp/droplit-edge/node_modules');

const installDist = done => runCommand('npm install', { cwd: 'temp/droplit-edge' }, done);

const packageTask = () => {
    const packageFileName = `${getPackageName(settings.edgeDir)}.tar`;
    return gulp.src(settings.packageFiles, { follow: true })
        .pipe(gulp.dest('dist/droplit-edge'))
        .pipe(G$.debug({ title: 'package:' }))
        .pipe(G$.tar(packageFileName))
        .pipe(G$.gzip())
        .pipe(gulp.dest('dist'));
};

const cleanTemp = () => del('temp');

/* Testing for improving package */
const prep = () => del(expandGlobs(settings.prep));

/* Version bumb */
const bump = (done, params) => {
    if (!params.project) {
        console.error(`${colors.red('No project specified!')}`);
        return done();
    }
    const typeFlags = { 1: 'major', 2: 'minor', 4: 'patch' };
    const typeValue = (params.hasOwnProperty('major') << 0) + (params.hasOwnProperty('minor') << 1) + (params.hasOwnProperty('patch') << 2);
    const typeName = typeFlags[typeValue];
    if (!typeName) {
        console.error(`${colors.red('Specify one version type to bump!')}`);
        return done();
    }

    const cwd = `projects/${params.project}/`;
    return gulp.src('./package.json', { cwd })
        .pipe(G$.bump({ typeName }))
        .pipe(gulp.dest('./', { cwd }));
};

/* Configure tasks */
gulp.task('install', install);
gulp.task('install').description = 'Install all npm modules';

gulp.task('link', link);
gulp.task('link').description = 'Link dependencies on local disk';

gulp.task('unlink', unlink);
gulp.task('unlink').description = 'Unlink dependencies on local disk';

gulp.task('clean', clean);
gulp.task('clean').description = 'Cleans the generated files from lib directory';

gulp.task('deep-clean', deepClean);
gulp.task('deep-clean').description = 'Cleans the generated files from lib directory and all node_modules';

gulp.task('setup', gulp.series('install', 'link'));
gulp.task('setup').description = 'Install all modules and link projects';

gulp.task('teardown', gulp.series('unlink', 'deep-clean'));
gulp.task('teardown').description = 'Clean all and unlink projects';

gulp.task('tslint', tslint);
gulp.task('tslint').description = 'Lints all TypeScript source files';

// Make project specific tasks
Object.keys(tsProjects).forEach(project => {
    gulp.task(`ts-${project}`, tsProjects[project]);
    gulp.task(`ts-${project}`).description = `Transpile ${colors.green(project)}`;
});

gulp.task('ts-all', gulp.series(projectNames.map(name => `ts-${name}`)));
gulp.task('ts-all').description = 'Transpile all projects';

gulp.task('build', gulp.series(gulp.parallel('tslint', 'clean'), 'ts-all'));
gulp.task('build').description = 'Compiles all TypeScript source files and updates module references';

gulp.task('watch', gulp.series('build', watch));
gulp.task('watch').description = 'Contiuous build';

gulp.task('debug', debug);
gulp.task('debug').description = 'Debug droplit-edge';

const installFlags = {
    '--pack': 'Package name',
    '--project': `Project name: (ex. ${colors.green(projectNames[0])})`
};

gulp.task('npm-i', parameterized(npmInstall));
gulp.task('npm-i').description = `Install and save a ${colors.cyan('pack')}age to a ${colors.cyan('project')}`;
gulp.task('npm-i').flags = installFlags;

gulp.task('npm-u', parameterized(npmUninstall));
gulp.task('npm-u').description = `Uninstall and save a ${colors.cyan('pack')}age to a ${colors.cyan('project')}`;
gulp.task('npm-u').flags = installFlags;

const projFlags = { '--project': `Project name: (ex. ${colors.green(projectNames[0])}}` };

gulp.task('stats', parameterized(stats));
gulp.task('stats').description = 'Get lines of code';
gulp.task('stats').flags = projFlags;

gulp.task('size', parameterized(size));
gulp.task('size').description = 'Get physical size of code';
gulp.task('size').flags = projFlags;

gulp.task('deploy', gulp.series('setup', cleanDist, 'build', 'unlink', moveTemp, setupPackage, preInstallDist, installDist, packageTask, cleanTemp));
gulp.task('deploy').description = 'Glob the Droplit Edge for embedding';

gulp.task('prep', prep);

gulp.task('bump', parameterized(bump));
gulp.task('bump').description = 'Version bump a project';
gulp.task('bump').flags = {
    '--major': 'when you make incompatible API changes',
    '--minor': 'when you add functionality in a backwards-compatible manner',
    '--patch': 'when you make backwards-compatible bug fixes',
    '--project': `Project name: (ex. ${colors.green(projectNames[0])})`
};

gulp.task('default', done => runCommand('gulp --tasks', { cwd: './' }, done));

/* Auxiliary functions */
function expandGlobs(globs) {
    return globs.reduce((p, c) =>
        p.concat(...(
            (c.indexOf(PROJECT_VAR) > 0) ? projectNames.map(name => c.replace(PROJECT_VAR, name)) : [c])
        ), []);
}

function getPackageName(packagePath) {
    const packageFile = require(path.join(path.resolve(packagePath), 'package.json')); // eslint-disable-line global-require
    return `${packageFile.name}_${packageFile.version}`;
}

function mapPath(glob, project) {
    return glob.replace(PROJECT_VAR, project);
}

function mapPaths(globs, project) {
    return globs.map(glob => mapPath(glob, project));
}

function runCommand(command, options, callback) {
    try {
        exec(command, options, (error, stdout, stderr) => {
            console.log(`${path.resolve(options.cwd || '.')} ${colors.cyan(command)}`);
            console.log(stdout);
            console.error(stderr);
            if (error)
                console.log('exec error: ', error);
            callback();
        });
    } catch (ex) {
        console.error('run command', ex);
    }
}

function wildcardPaths(globs) {
    return globs.reduce((p, c) =>
        p.concat((c.indexOf(PROJECT_VAR) > 0) ? c.replace(PROJECT_VAR, '*') : c), []);
}