'use strict';

var path = require('path');
var assert = require('yeoman-generator').assert;
var helpers = require('yeoman-generator').test;
var os = require('os');

describe('jaMann:app', function () {
  before(function (done) {
    helpers.run(path.join(__dirname, '../app'))
      .inDir(path.join(os.tmpdir(), './temp-test'))
      .withOptions({ 'force': true })
      .withPrompt({
        name: 'name',
        projectType: 'drupal',
        password: ''
      })
      .on('end', done);
  });

  it('creates files', function () {
    assert.file([
      './name/',
      './name/public/',
      './name/_tools/fabalicious',
      './name/fabfile.yaml'
    ]);
  });
});
