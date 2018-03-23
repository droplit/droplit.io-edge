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
install.description = 'Install all npm modules';
gulp.task(install);

/* npm link */

const link = done => { linker(true, done); };
link.description = 'Link dependencies on local disk';
gulp.task(link);

const unlink = done => { linker(false, done); };
unlink.description = 'Unlink dependencies on local disk';
gulp.task(unlink);

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
                    const { name } = require(`./projects/${dependency}/package.json`);
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
clean.description = 'Cleans the generated files from lib directory';
gulp.task(clean);

const deepclean = () => del(expandGlobs(settings.deepClean));
deepclean.description = 'Cleans the generated files from lib directory and all node_modules';
gulp.task(deepclean);

/* npm setup */
const setup = gulp.series('install', 'link');
setup.description = 'Install all modules and link projects';
gulp.task('setup', setup);

const teardown = gulp.series('unlink', 'deepclean');
teardown.description = 'Clean all and unlink projects';
gulp.task('teardown', teardown);

/* Building */
const tslint = () =>
    gulp.src(wildcardPaths(settings.tsfiles))
        .pipe(G$.tslint({ formatter: 'verbose' }))
        .pipe(G$.tslint.report({ emitError: false }));
tslint.description = 'Lints all TypeScript source files';
gulp.task(tslint);

/* Transpiling */
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
    tsProj.description = `Transpile ${colors.green(project)}`;
    gulp.task(`ts-${project}`, tsProj);
});

const tsAll = done => gulp.series(projectNames.map(name => `ts-${name}`))(done);
tsAll.description = 'Transpile all projects';
gulp.task('ts-all', tsAll);

/* Build */
const build = done => gulp.series(gulp.parallel('tslint', 'clean'), 'ts-all')(done);
build.description = 'Compiles all TypeScript source files and updates module references';
gulp.task('build', build);

const watch = gulp.series('build', () => {
    projectNames.forEach(project =>
        gulp.watch(mapPaths(Array.prototype.concat(settings.tsfiles, settings.jsFiles), project), gulp.parallel(`ts-${project}`)));
});
watch.description = 'Contiuous build';
gulp.task('watch', watch);

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
build.description = 'Debug droplit-edge';
gulp.task('debug', debug);

/* Dependencies */
const installFlags = {
    '--pack': 'Package name',
    '--project': `Project name: (ex. ${colors.green(projectNames[0])})`
};

const npmInstall = parameterized((done, params) => {
    if (!params.pack || !params.project) {
        console.error('Must specify a package and project');
        return done();
    }

    runCommand(`npm install --save ${params.pack}`, { cwd: mapPath(settings.projectPath, params.project) }, done);
});
npmInstall.description = `Install and save a ${colors.cyan('pack')}age to a ${colors.cyan('project')}`;
npmInstall.flags = installFlags;
gulp.task('npm-i', npmInstall);

const npmUninstall = parameterized((done, params) => {
    if (!params.pack || !params.project) {
        console.error('Must specify a package and project');
        return done();
    }

    runCommand(`npm uninstall --save ${params.pack}`, { cwd: mapPath(settings.projectPath, params.project) }, done);
});
npmUninstall.description = `Uninstall and save a ${colors.cyan('pack')}age to a ${colors.cyan('project')}`;
npmUninstall.flags = installFlags;
gulp.task('npm-u', npmUninstall);

/* Code analysis */
const projFlags = {
    '--project': `Project name: (ex. ${colors.green(projectNames[0])}}`
};

const stats = parameterized((done, params) => {
    if (params.project) {
        console.log(`Source Lines of Code: ${colors.green(params.project)}`);
        return gulp.src(mapPaths(settings.sloc_project, params.project)).pipe(G$.sloc({ tolerant: true }));
    }

    console.log(`Source Lines of Code: ${colors.white('ALL')}`);
    return gulp.src(settings.sloc_all).pipe(G$.sloc({ tolerant: true }));
});
stats.description = 'Get lines of code';
stats.flags = projFlags;
gulp.task('stats', stats);

const size = parameterized((done, params) => {
    if (params.project) {
        console.log(`Source Lines of Code: ${colors.green(params.project)}`);
        return gulp.src(mapPaths(settings.runtimeFiles, params.project)).pipe(G$.size({ showFiles: true }));
    }

    console.log(`Source Lines of Code: ${colors.white('ALL')}`);
    return gulp.src(expandGlobs(settings.runtimeFiles)).pipe(G$.size({ showFiles: true }));
});
size.description = 'Get size of code';
size.flags = projFlags;
gulp.task('size', size);

/* Deployment */
const cleanDist = () => del('dist');
cleanDist.displayName = 'clean-dist';

const moveTemp = () =>
    gulp.src(settings.edgeFiles, { follow: true })
        .pipe(gulp.dest('temp/droplit-edge'));
moveTemp.displayName = 'move-temp';

const setupPackage = () =>
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
                Object.keys(localConfig.plugins)
                    .filter(plugin => localConfig.plugins[plugin] && localConfig.plugins[plugin].enabled !== false)
                    .forEach(plugin => (json.dependencies[plugin] = `../../projects/${plugin}`));

            return json;
        }))
        .pipe(gulp.dest('temp/droplit-edge/'));
setupPackage.displayName = 'setup-package';

const preInstallDist = () => del('temp/droplit-edge/node_modules');
preInstallDist.displayName = 'pre-install-dist';

const installDist = done => runCommand('npm install', { cwd: 'temp/droplit-edge' }, done);
installDist.displayName = 'install-dist';

const packageTask = () => {
    const packageFileName = `${getPackageName(settings.edgeDir)}.tar`;
    return gulp.src(settings.packageFiles, { follow: true })
        .pipe(gulp.dest('dist/droplit-edge'))
        .pipe(G$.debug({ title: 'package:' }))
        .pipe(G$.tar(packageFileName))
        .pipe(G$.gzip())
        .pipe(gulp.dest('dist'));
};
packageTask.displayName = 'package';

const cleanTemp = () => del('temp');
cleanTemp.displayName = 'clean-temp';

const buildDist = done => gulp.series(cleanDist, 'build', 'unlink', moveTemp, setupPackage, preInstallDist, installDist, packageTask, cleanTemp)(done);
buildDist.displayName = 'build-dist';

const deploy = gulp.series('setup', buildDist);
deploy.description = 'Glob the Droplit Edge for embedding';
gulp.task('deploy', deploy);

/* Testing for improving package */
const prep = () => del(expandGlobs(settings.prep));
gulp.task('prep', prep);

/* Version bumb */
const bump = parameterized((done, params) => {
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
});
bump.description = 'Version bump a project';
bump.flags = {
    '--major': 'when you make incompatible API changes',
    '--minor': 'when you add functionality in a backwards-compatible manner',
    '--patch': 'when you make backwards-compatible bug fixes',
    '--project': `Project name: (ex. ${colors.green(projectNames[0])})`
};
gulp.task('bump', bump);

/* Auxiliary functions */
function expandGlobs(globs) {
    return globs.reduce((p, c) =>
        p.concat(...(
            (c.indexOf(PROJECT_VAR) > 0) ? projectNames.map(name => c.replace(PROJECT_VAR, name)) : [c])
        ), []);
}

function getPackageName(packagePath) {
    const packageFile = require(path.join(path.resolve(packagePath), 'package.json'));
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

gulp.task('default', done => runCommand('gulp --tasks', { cwd: './' }, done));