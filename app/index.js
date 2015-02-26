'use strict';
var generators = require('yeoman-generator');
var chalk = require('chalk');
var updateNotifier = require('update-notifier');
var yosay = require('yosay');
var _ = require('underscore');
var fs = require('fs');
var fse = require('fs-extra-promise');
var shell = require('shelljs');
var async = require('async');

module.exports = generators.Base.extend({

  constructor: function () {
    generators.Base.apply(this, arguments);

    this.options = {
      fabalicious: true,
    };
  },

  initializing: function () {
    // Check for updates.
    var pkg = require('../package.json');
    updateNotifier({pkg: pkg}).notify();

    // @TODO: do this better.
    // Check for multibasebox.
    if (!fse.existsSync('./projects')){
      this.log(chalk.red('You must be in your multibasebox folder. Multibasebox not installed? We will create a generator for that! Until that please follow the instructions here: github.com/stmh/multibasebox'));
      shell.exit(1);
    }

    // Check requirements.
    var requirements = {
      pip: 'brew install python',
      fab: 'pip install fabric',
      drush: 'brew install drush',
      // @TODO: Need a check for pyyaml.
      //pyyaml: 'pip install pyyaml',
    };
    _.each(requirements, function(value, key){
      if (!shell.which(key)) {
        console.log('Sorry, this script requires ' + key + '. Install it on a Mac using: ' + value);
        shell.exit(1);
      }
    });

  },

  _getPaths : function(projectName) {
    var base = process.env.PWD;
    return {
      'base': base,
      'tools': base + '/projects/' + projectName + '/_tools',
      'project': base + '/projects/' + projectName
    };
  },

  _getAvailablePort: function(callback) {
    var that = this;

    // get all project folders:
    var rootDir = this._getPaths().base + '/projects';
    var files = fs.readdirSync(rootDir);
    var dirs = [];
    _.each(files, function(file) {
      if (file[0] !== '.') {
        var filePath = rootDir + '/' + file;
        try {
          var stat = fs.statSync(filePath + '/fabfile.py');

          if(stat.isFile()) {
             dirs.push(file);
          }
        }
        catch(e) {

        }
      }
    });

    if (dirs.length === 0) {
      callback(222);
    }

    var ports = [];
    async.each(dirs, function(dir, done) {

      var cmd = 'cd ' + rootDir + '/' + dir + '; fab  --hide=running config:mbb getProperty:port';
      shell.exec(cmd, { 'silent': true }, function(code, output) {
        if (code) {
          that.log(chalk.red('Could not get port-setting for project ' + dir + ', please update fabalicious.'));
        }
        else {
          var lines = output.split('\n');
          var foundPort = false;

          lines.reverse();
          _.each(lines, function(line) {
            line = line.trim();
            if ((line.length > 0) && !foundPort) {
              foundPort = line;
              console.log('found: ' + foundPort);
            }
          });
          if (foundPort) {
            ports.push(parseInt(foundPort));
          }
        }
        // notify async that we are finished with this async-task.
        done();
      });
    }, function() {
      // final callback, when all tasks are finished, compute port.
      var highestPort = 222;
      _.each(ports, function(port) {
        if(port > highestPort) {
          highestPort = port;
        }
      });
      // notify caller that we are finished.
      callback(highestPort);
    });


  },

  _installFabalicious : function() {
    if (!this.options.fabalicious) {
      return false;
    }

    this.log('Installing fabalicious');
  },


  // Run commands in shell.
  _runCommands : function(commands, paths,callback) {
    var that = this;

    console.log(paths);

    // Loop through commands.
    async.each(commands, function(cmd, done){
      var command = '(cd ' + paths.project + '; ' + cmd.cmd + ') > /dev/null 2>&1';
      shell.exec(command, function() {
        that.log(chalk.green('Running install task: ' + cmd.name));
        done();
      });
    }, callback);
  },

  // Copy template files.
  _copyTplFiles: function(tplFiles) {

    var that = this;
    _.each(tplFiles, function(value) {
      that.fs.copyTpl(that.templatePath(value.from), that.destinationPath(value.to), value.values);
    });
  },

  // Install Drupal.
  _installDrupal : function() {
    var paths = this._getPaths(this.answer.name);
    var that = this;

    this.log('Installing Drupal');

    // Check if the paths.project exists already.
    // @TODO: do this earlier.
    if (fse.existsSync(paths.project)){
      this.log(chalk.red('Project exists already.'));
      shell.exit(1);
    }

    fse.mkdirsAsync(paths.tools).then(function(){
        // Run shell commands.
        var commands = [
          {
            'name': 'init git',
            'cmd': 'git init'
          },
          {
            'name': 'add fabalicious as submodule',
            'cmd': 'git submodule add https://github.com/stmh/fabalicious.git ' + paths.tools + '/fabalicious'
          },
          {
            'name': 'create symlink to fabalicious',
            'cmd': 'ln -s _tools/fabalicious/fabfile.py fabfile.py'
          },
          {
            'name': 'add drupal-docker as submodule',
            'cmd': 'git submodule add https://github.com/stmh/drupal-docker.git ' + paths.tools + '/docker',
          },
          {
            'name': 'download drupal',
            'cmd': 'drush dl drupal --destination=' + paths.project + ' --drupal-project-rename=public',
          }
          // this won't work async
          //dockerRun: '(cd ' + paths.project + ' ; fab config:mbb docker:run)',
          //dockerInstall: '(cd ' + paths.project + ' ; fab config:mbb install)'
        ];


        this._runCommands(commands, paths, function() {

          // Copy tpl files.
          this._getAvailablePort(function(port) {

            var values = {
              name: this.answer.name,
              port: port +1
            };

            var tplFiles = [
              {
                from : 'drupal/_fabfile.yaml',
                to : 'projects/' + this.answer.name + '/fabfile.yaml',
                values: values
              },
              {
                from : 'drupal/_gitignore',
                to : 'projects/' + this.answer.name + '/.gitignore',
                values: values
              }
            ];

            that._copyTplFiles(tplFiles);
          }.bind(this));
        }.bind(this));
      }
    .bind(this));
  },



  // Prompt for options.
  prompting: function () {
    var that = this;
    var cb = this.async();

    // Say yo!
    this.log(yosay(
      'Welcome to the ' + chalk.red('JaMann') + ' generator!'
    ));

    this.prompt([{
      type: 'input',
      name: 'name',
      message: 'Name of your project',
      validate: function(input) {
        if (input.match(/^[a-zA-Z0-9_]+$/) && input.length > 3 && input.length < 31) {
          return true;
        }
        else {
          return 'Project name can only contain letters, numbers and underscores and cannot be fewer than 4 or more than 30 characters';
        }
      },
    }, {
      name: 'projectType',
      type: 'list',
      message: 'What kind of docker container do you wish?',
      choices: [
        'Drupal',
        'Wordpress',
        'Middleman',
        { 'value': 'SimpleWebserver', 'name': 'Simple Webserver'}
      ]
    }], function (answer) {
      that.answer = answer;
      cb();
    });
  },


  install: function () {
    var funcName = '_install' + this.answer.projectType;
    if (this[funcName]) {
      this[funcName]();
    }
    else {
      this.log(chalk.red(this.answer.projectType + ' not implemented yet!'));
      }
  }
});
