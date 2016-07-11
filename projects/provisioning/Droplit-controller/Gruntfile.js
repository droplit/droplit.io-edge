module.exports = function (grunt) {

    // configure
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        nodeunit: {
            all: ['api/*.test.js', 'modules/*.test.js']
            // uncomment the code below to make the unit tests 'automatable'
            //,
//            options: {
//                reporter: 'junit',
//                reporterOptions: {
//                    output: 'tests'
//                }
//            }
        },
        apidoc: {
            rest_api: {
                src: "./api",
                dest: "public/rest",
                template: "./apidoc-template",
                includeFilters: [ ".*\.js$" ],
                excludeFilters: [ ".*node_modules.*" ],
                debug: false,
                marked: {
                    gfm: true
                }
            },
            socket_api: {
                src: "./docs_socket",
                dest: "public/socket",
                template: "./apidoc-template",
                includeFilters: [ ".*\.js$" ],
                excludeFilters: [ ".*node_modules.*" ],
                debug: false,
                marked: {
                    gfm: true
                }
            }
        }
    });

    // load plugins
    grunt.loadNpmTasks('grunt-contrib-nodeunit');
    grunt.loadNpmTasks('grunt-apidoc');

    // Default task(s).
    grunt.registerTask('default', ['nodeunit', 'apidoc']);
}