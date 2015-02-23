'use strict';
var generators = require('yeoman-generator');
var chalk = require('chalk');
var updateNotifier = require('update-notifier');
var yosay = require('yosay');
var _ = require('underscore');
var fse = require('fs-extra-promise');
var shell = require('shelljs');


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

  _installFabalicious : function() {
    if (!this.options.fabalicious) {
      return false;
    }

    this.log('Installing fabalicious');
  },


  // Run commands in shell.
  _runCommands : function(commands) {
    // Loop through commands.
    _.each(commands, function(value, key){
      value = value + ' > /dev/null 2>&1';
      shell.exec(value, function(code, output, list) {
        that.log(chalk.green('Running install task for: ' + key));
      });
    });
  },

  // Copy template files.
  _copyTplFiles: function(tplFiles) {
    that.fs.copyTpl(
      that.templatePath('drupal/_fabfile.yaml'),
      that.destinationPath('projects/' + that.answer.name + '/fabfile.yaml'),
      { name: that.answer.name }
    );
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

    // Create paths.project.
    // this get in here!
    fse.mkdirsAsync(paths.tools).then(function(that){
      // Run shell commands.
      var commands = {
        gitInit: '(cd ' + paths.project + '; git init)',
        fabalicious: '(cd ' + paths.project + ' ; git submodule add https://github.com/stmh/fabalicious.git ' + paths.tools + '/fabalicious)',
        symlinkFabalicious: '(cd ' + paths.project + '; ln -s _tools/fabalicious/fabfile.py fabfile.py)',
        drupaldocker: '(cd ' + paths.project + '; git submodule add https://github.com/stmh/drupal-docker.git ' + paths.tools + '/docker)',
        drupalDownload: 'drush dl drupal --destination=' + paths.project + ' --drupal-project-rename=public'
      };

      that._runCommands(commands);

      // Copy tpl files.
      var tplFiles = {
        from : 'drupal/_fabfile.yaml',
        to : 'projects/' + that.answer.name + '/fabfile.yaml',
        values: {
          name: that.answer.name
        }
      };
      //that._copyTplFiles(commands);

      /*
      that.fs.copyTpl(
        that.templatePath('drupal/_gitignore'),
        that.destinationPath('projects/' + that.answer.name + '/.gitignore'),
        { name: that.answer.name }
      );
      */
    });
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
        return input.match(/^[a-zA-Z0-9_]+$/)? true : 'project name can only contain letters, numbers and underscores';
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
