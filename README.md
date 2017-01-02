# generator-jamann

## what it does

This generator scaffolds a new drupal 8 project using [drupal-composer/drupal-project](https://github.com/drupal-composer/drupal-project) for
creating the actual project.

The generator adds a barebone deploy-module, requires [fabalicious](https://github.com/factorial-io/fabalicious) and uses
[multibasebox](https://github.com/factorial-io/multibasebox) to spin up the dev-boxes via docker-compose. It
assumes a multibasebox-setup.

## how to install

1. Clone this repository and checkout the develop-branch.
2. cd into the folder
3. run `npm link`

This is necessary as the project is not published to the npm-registry yet.

## how to run

1. cd into your multibasebox-folder
2. run `yo jamann`
3. provide a project-name.
4. wait.

## what you should do next

1. cd into the new project
2. run `git init .`
3. run `fab config:mbb docker:run`
4. run `fab config:mbb install`

## License

Stephan Maximilian Huber wrote this generator. As long as you retain this notice you can do whatever you want with this stuff. If we meet some day, and you think this stuff is worth it, you can buy me a beer in return.

