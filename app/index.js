'use strict';
var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var yosay = require('yosay');
var mkdirp = require('mkdirp');
var updateNotifier = require('update-notifier');
var _ = require('underscore');
var fse = require('fs-extra-promise');
require('shelljs/global');


module.exports = yeoman.generators.Base.extend({
  initializing: function () {
    // Check for updates.
    var pkg = require('../package.json');
    updateNotifier({pkg: pkg}).notify();

    // @TODO: do this better.
    // Check for multibasebox.
    if (!fse.existsSync('./projects')){
      this.log(chalk.red('You must be in your multibasebox folder. Multibasebox not installed? We will create a generator for that! Until that please follow the instructions here: github.com/stmh/multibasebox'));
      exit(1);
    }

    // Check requirements.
    var requirements = {
      pip: 'brew install python',
      fab: 'pip install fabric',
      drush: 'brew install drush',
      // @TODO: Need a check for pyyaml.
      //pyyaml: 'pip install pyyaml',
    }
    _.each(requirements, function(value, key){
      if (!which(key)) {
        console.log('Sorry, this script requires ' + key + '. Install it on a Mac using: ' + value);
        exit(1);
      }
    });
  },

  // Why do i have to pass this?
  writing: {
    drupal: function (answer, that) {
      var base = process.env.PWD
      var publicPath = base + '/projects/' + answer.name + '/public';
      var toolsPath = base + '/projects/' + answer.name + '/_tools';
      var projectPath = base + '/projects/' + answer.name;

      // Check if the projectPath exists already.
      if (fse.existsSync(projectPath)){
        that.log(chalk.red('Project exists already.'));
        exit(1);
      }

      // Create projectPath.
      fse.mkdirsAsync(toolsPath).then(function(){
        // Commmands should be configurable.
        var commands = {
          gitInit: '(cd ' + projectPath + '; git init)',
          fabalicious: '(cd ' + projectPath + ' ; git submodule add https://github.com/stmh/fabalicious.git ' + toolsPath + '/fabalicious)',
          drupaldocker: '(cd ' + projectPath + '; git submodule add https://github.com/stmh/drupal-docker.git ' + toolsPath + '/docker)',
          drupalDownload: 'drush dl drupal --destination=' + projectPath + ' --drupal-project-rename=public'
        };

        // Loop through commands.
        _.each(commands, function(value, key){
          value = value + ' > /dev/null 2>&1';
          exec(value, function(code, output, list) {
            that.log(chalk.green('Running install task for: ' + key));
          });
        });

        // @TODO: Copy fabfile FAILS!
        that.fs.copyTpl(
          that.templatePath('_fabfile.yaml'),
          that.destinationPath(projectPath + '/fabfile.yaml'),
          { name: answer.name }
        );
        console.log(projectPath + '/fabfile.yaml');

      });

      // TODO: Executed to early.
      that.log(chalk.green('Mega! Project is ready!'));
    },

    wordpress: function () {
    },

    middleman: function () {
    },

    simple: function () {
    }
  },

  // Prompt for options.
  prompting: function () {
    var done = this.async();
    var that = this;

    // Say yo!
    this.log(yosay(
      'Welcome to the ' + chalk.red('JaMann') + ' generator!'
    ));

    this.prompt([{
      name: 'name',
      message: 'Name of your project',
      validate: function(input) {
        // why?
        var done = this.async();
        if (/\W/.test(input) || input.length === 0){
          done("You need to provide letters, numbers and underscores only");
          return;
        }
        // We are done.
        done(true);
      },
    }, {
      name: 'projectType',
      type: 'list',
      message: 'What kind of docker container do you wish?',
      choices: ['drupal', 'wordpress', 'middleman', 'simple webserver']
    }], function (answer) {
      // @TODO: that.writing.{variable} -> function call.
      if (answer.projectType == 'drupal') {
        that.writing.drupal(answer, that);
      }else{
        that.log(chalk.red('Not supported right now.'));
      }
    });
  },

  // Example for options.
  install: function () {
    this.installDependencies({
      skipInstall: this.options['skip-install']
    });
  }
});
