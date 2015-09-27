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
var cowsay = require('cowsay');
var request = require('request');


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
      this.log(chalk.red('You must be in your multibasebox folder. Multibasebox not installed? We will create a generator for that! Until that please follow the instructions here: github.com/factorial-io/multibasebox'));
      shell.exit(1);
    }
  },

  _checkRequirements: function(cmds) {
    // Check requirements.
    var requirements = {
      composer: 'curl -sS https://getcomposer.org/installer | php',
      pip: 'brew install python',
      fab: 'pip install fabric',
      drush: 'brew install drush',
      wp: 'curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar\nchmod +x wp-cli.phar\nsudo mv wp-cli.phar /usr/local/bin/wp'

      // @TODO: Need a check for pyyaml.
      //pyyaml: 'pip install pyyaml',
    };
    _.each(cmds, function(key) {
      var command = requirements[key];
      if (!shell.which(key)) {
        console.log('Sorry, this script requires ' + key + '. Install it on a Mac using: ' + command);
        shell.exit(1);
      }
    });
  },

  _getPaths : function(projectName) {
    var base = process.env.PWD;
    return {
      'base': base,
      'tools': base + '/projects/' + projectName + '/_tools',
      'project': base + '/projects/' + projectName,
      'projectRelative': 'projects/' + projectName
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
              // console.log('found: ' + foundPort);
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

  // Run commands in shell.
  _runCommands : function(commands, paths,callback) {
    var that = this;
    var runAsync = true;
    _.each(commands, function(elem) {
      if ((elem.async !== undefined) && (elem.async === false)) {
        runAsync = false;
      }
    });
    var fn = runAsync ? 'each' : 'eachSeries';
    // console.log('running commands async: ', runAsync);

    // Loop through commands.
    async[fn](commands, function(cmd, done){
      var command = '(cd ' + paths.project + '; ' + cmd.cmd + ') ';
      that.log('starting task: ' + cmd.name);
      shell.exec(command, {'silent': 1}, function(code, output) {
        if (code === 0) {
          that.log(chalk.green('install task succeeded: ' + cmd.name));
        } else {
          that.log(chalk.red('install task failed: ' + cmd.name));

          that.log(output);
        }
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

  _installCommon: function(paths, commands, templates, values, cb) {
    var that = this;

    // available commands is an array, holding all available commands. YOu can specify slots in which the
    // command should be run, lower slots gets executed earlier. If you specify
    // async: false, then all commands are executed serially, not in parallel.
    // We use slot 900 for all git-related commands, as these may not be executed in parallel.

    var availableCommands = {
      'gitInit': [
        {
          'name': 'init git',
          'cmd': 'git init',
          'slot': 1
        },
        {
          'name': 'commit to git',
          'cmd': 'git commit -m "Initial commit."',
          'slot': 1000
        },

      ],
      'fabalicious': [
        {
          'name': 'add fabalicious as submodule',
          'cmd': 'git submodule add -f https://github.com/factorial-io/fabalicious.git _tools/fabalicious',
          'slot': 2
        },
        {
          'name': 'create symlink to fabalicious',
          'cmd': 'ln -s _tools/fabalicious/fabfile.py fabfile.py',
          'slot': 3
        },
        {
          'name': 'add fabfile.py to git',
          'cmd': 'git add fabfile.py',
          'slot': 900,
          'async': false
        },
      ],
      'composer': [
       {
          'name': 'run composer to install the stack.',
          'cmd':  'composer install',
          'slot': 2
        },
        {
          'name': 'add files to git',
          'cmd': 'git add composer.lock && git commit -m "Adding .gitignore and composer-files."',
          'slot': 901,
          'async': false
        },{
          'name': 'add files to git',
          'cmd': 'git add public _tools vendor',
          'slot': 902,
          'async': false
        },
        {
          'name': 'install drupal database',
          'cmd': 'fab config:mbb install:ask=0,distribution='+values.profile,
          'slot': 11,
        },
      ],
      'drupal': [
        {
          'name': 'add drupal-docker as submodule',
          'cmd': 'git submodule add -f https://github.com/factorial-io/drupal-docker.git _tools/docker',
          'slot': 2
        },
        {
          'name': 'download ' + values.distribution,
          'cmd': 'drush dl ' + values.distribution + ' --destination=' + paths.project + ' --drupal-project-rename=public --default-major=' + values.drupalVersion,
          'slot': 2
        },
        {
          'name': 'add drupal to git',
          'cmd': 'git add public',
          'slot': 900,
          'async': false
        },
        {
          'name': 'install drupal database',
          'cmd': 'fab config:mbb install:ask=0,distribution='+values.profile,
          'slot': 11,
        },
      ],
      'runDocker': [
        {
          'name': 'run docker',
          'cmd': 'fab config:mbb docker:run',
          'slot': 10,
        }],
      'vagrantProvision': [
        {
          'name': 'Vagrant provision',
          'cmd': 'cd ../..; echo "' + values.password + '" | sudo -S vagrant hostmanager',
          'slot': 1
        }
      ],
      'wordpress': [
        {
          'name': 'add drupal-docker as submodule',
          'cmd': 'git submodule add -f https://github.com/factorial-io/drupal-docker.git _tools/docker',
          'slot': 2
        },
        {
          'name': 'download wordpress',
          'cmd': 'wp core download --path=' + paths.project + '/public',
          'slot': 2
        },
        {
          'name': 'install wordpress database',
          'cmd': 'fab config:mbb install:ask=0',
          'slot': 11,
        },
        {
          'name': 'add wordpress to git',
          'cmd': 'git add public',
          'slot': 900,
          'async': false
        }
      ],
    };

    var commandsToExecute = [];

    _.each(commands, function(command) {
      if (availableCommands[command]) {
        // Add the commands to the list
        _.each(availableCommands[command], function(cmd) {
          if (!commandsToExecute[cmd.slot]) {
            commandsToExecute[cmd.slot] = [];
          }
          commandsToExecute[cmd.slot].push(cmd);
        });
      }
      else {
        that.log(chalk.red('Unknown command: ' + command));
      }
    });

    var tplFiles = [];
    _.each(templates, function(target, source) {
      if (!commandsToExecute[900]) {
        commandsToExecute[900] = [];
      }
      commandsToExecute[900].push({
        'name': 'add ' + target + ' to git',
        'cmd': 'git add ' + target,
        'slot': 900,
        'async': false
      });

      tplFiles.push({
        from: source,
        to: paths.projectRelative + '/' + target,
        values: values
      });
    });

    // copy tpl files first.
    this._copyTplFiles(tplFiles);

    var slots = Object.keys(commandsToExecute);
    var currentSlotNdx = 0;

    async.whilst(
      function() { return currentSlotNdx < slots.length; },
      function(callback) {
        // console.log('running commands in slot ' + slots[currentSlotNdx]);
        that._runCommands(commandsToExecute[slots[currentSlotNdx]], paths, function() {
          currentSlotNdx++;
          callback();
        });
      },
      function() {
        cb();
      }
    );
  },

  _installTemplateFiles: function(paths, templates, values) {
    var tplFiles = [];
     _.each(templates, function(target, source) {
      tplFiles.push({
        from: source,
        to: paths.projectRelative + '/' + target,
        values: values
      });
    });
    this._copyTplFiles(tplFiles);
  },




  // Install Drupal.
  _installDrupal : function(version) {
    this._checkRequirements(['pip', 'fab', 'drush']);
    var paths = this._getPaths(this.answer.name);
    var values = this.answer;

    if (version === undefined) {
      version = 7;
    }

    this.log('Installing Drupal ' + version);

    fse.mkdirsAsync(paths.tools).then(function(){
      this._getAvailablePort(function(port) {

        values.port = port + 1;
        values.drupalVersion = version;
        if (!values.distribution) {
          values.distribution = 'drupal';
          values.profile = 'minimal';
        }
        else {
          values.profile = values.distribution;
        }

        var commands = ['gitInit', 'fabalicious', 'drupal', 'runDocker', 'vagrantProvision'];


        var templates = {
          'drupal/_fabfile.yaml' : 'fabfile.yaml',
          'drupal/_gitignore': '.gitignore'
        };
        this._installCommon(paths, commands, templates, values, function() {
          this.log(chalk.green('Scaffolding finished.'));
        }.bind(this));
      }.bind(this));
    }.bind(this));
  },


  // Install Drupal via composer
  _installDrupalComposer : function(version) {
    this._checkRequirements(['composer', 'pip', 'fab', 'drush']);
    var paths = this._getPaths(this.answer.name);
    var values = this.answer;

    if (version === undefined) {
      version = 7;
    }

    this.log('Installing Drupal ' + version + ' via composer');

    fse.mkdirsAsync(paths.tools).then(function(){
      this._getAvailablePort(function(port) {

        values.port = port + 1;
        values.drupalVersion = version;
        if (!values.distribution) {
          values.distribution = 'drupal';
          values.profile = 'minimal';
        }
        else {
          values.profile = values.distribution;
        }

        var commands = ['gitInit', 'composer', 'runDocker'];
        var templateFolder = 'drupal-' + version + '-composer/';

        var templates = {};
        templates['drupal/_fabfile.yaml'] = 'fabfile.yaml';
        templates[templateFolder + '_gitignore'] = '.gitignore';
        templates[templateFolder + '_composer.json'] = 'composer.json';

        this._installCommon(paths, commands, templates, values, function() {
          var templateFiles = {};
          var targetFolder = 'public/sites/all/modules/custom/' + values.name + '_deploy/';
          if(version == 8) {
            targetFolder = 'public/modules/custom/' + values.name + '_deploy/';
            templateFiles[templateFolder + '_deploy.info.yml']    = targetFolder + values.name + '_deploy.info.yml';
            templateFiles[templateFolder + '_deploy_composer.json']    = targetFolder + 'composer.json';
          }
          else {
            templateFiles[templateFolder + '_deploy.info']    = targetFolder + values.name + '_deploy.info';
          }
          templateFiles[templateFolder + '_deploy.module']  = targetFolder + values.name + '_deploy.module';
          templateFiles[templateFolder + '_deploy.install'] = targetFolder + values.name + '_deploy.install';

          this._installTemplateFiles(paths, templateFiles, values);

          this.log(chalk.green('Scaffolding finished.'));
        }.bind(this));
      }.bind(this));
    }.bind(this));
  },

  _installDrupal7Composer: function() {
    this._installDrupalComposer(7);
  },

  _installDrupal8Composer: function() {
    this._installDrupalComposer(8);
  },

  // Install Wordpress.
  _installWordpress : function() {

    this._checkRequirements(['pip', 'fab', 'wp']);

    var paths = this._getPaths(this.answer.name);
    var values = this.answer;

    this.log('Installing Wordpress');

    fse.mkdirsAsync(paths.tools).then(function(){
      this._getAvailablePort(function(port) {

        values.port = port + 1;


        var commands = ['gitInit', 'fabalicious', 'wordpress', 'runDocker', 'vagrantProvision'];


        var templates = {
          'wordpress/_fabfile.yaml' : 'fabfile.yaml',
          'wordpress/_gitignore': '.gitignore',
          'wordpress/_wp-config.php': 'public/wp-config.php'
        };
        this._installCommon(paths, commands, templates, values, function() {
          this.log(chalk.green('Scaffolding finished.'));
        }.bind(this));
      }.bind(this));
    }.bind(this));
  },

  // Install Drupal 8.
  _installDrupal8 : function() {
    this._installDrupal(8);
  },

  // Install Drupal 8.
  _installDrupalDistribution : function() {
    this._installDrupal();
  },

  _installSimpleWebserver: function() {

    var paths = this._getPaths(this.answer.name);
    var values = this.answer;

    this.log('Installing a simple nginx based webserver');

    fse.mkdirsAsync(paths.tools).then(function(){
      this._getAvailablePort(function(port) {

        this.answer.port = port +1;

        var commands = ['gitInit', 'fabalicious', 'vagrantProvision'];
        var templates = {
          'simple-webserver/_fabfile.yaml' : 'fabfile.yaml',
          'simple-webserver/_gitignore': '.gitignore',
          'simple-webserver/_index.html': 'public/index.html',
          'simple-webserver/_site-enabled.conf': 'sites-enabled/' + this.answer.name + '.conf',

        };
        this._installCommon(paths, commands, templates, values, function() {
          this.log(chalk.green('Scaffolding finished.'));
        }.bind(this));
      }.bind(this));
    }.bind(this));
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
    },
    {
      name: 'projectType',
      type: 'list',
      message: 'What kind of docker container do you wish?',
      choices: [
        'Drupal',
        {'value': 'Drupal8', 'name': 'Drupal 8'},
        {'value': 'DrupalDistribution', 'name': 'A drupal-based distribution'},
        {'value': 'Drupal7Composer', 'name': 'Drupal 7 via composer (Factorial Stack)'},
        {'value': 'Drupal8Composer', 'name': 'Drupal 8 via composer (Factorial Stack)'},
        'Wordpress',
        'Middleman',
        { 'value': 'SimpleWebserver', 'name': 'Simple Webserver'}
      ]
    },
    {
      when: function(response) {
        return (response.projectType === 'DrupalDistribution');
      },
      name: 'distribution',
      type: 'input',
      message: 'Name of the drupal-distribution to install',
      validate: function(input) {
        var done = this.async();
        request('http://drupal.org/project/'+input, function (err, resp) {
          if (resp.statusCode === 200) {
            done(true);
          }
          done('Could not find distribution \'' + input + '\' at drupal.org');
        });
      },
    },
    {
      name: 'password',
      type: 'password',
      message: 'What\'s your admin-password? (It\'s needed for vagrant)',
      validate: function() {
        return true;
      },
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
      this.log(cowsay.say({text: 'Sorry! ' + this.answer.projectType + ' not implemented yet!'}));
    }
  }
});
