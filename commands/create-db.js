/**
 * Create DB command
 * @module commands/create-db
 */
const path = require('path');
const fs = require('fs');
const read = require('read');
const argvParser = require('argv');

/**
 * Command class
 */
class CreateDb {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} config           Configuration
     * @param {Runner} runner           Runner service
     */
    constructor(app, config, runner) {
        this._app = app;
        this._config = config;
        this._runner = runner;
    }

    /**
     * Service name is 'commands.createDb'
     * @type {string}
     */
    static get provides() {
        return 'commands.createDb';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'runner' ];
    }

    /**
     * Run the command
     * @param {string[]} argv           Arguments
     * @return {Promise}
     */
    run(argv) {
        let args = argvParser
            .option({
                name: 'help',
                short: 'h',
                type: 'boolean',
            })
            .run(argv);

        return new Promise((resolve, reject) => {
                read({ prompt: 'Destroy the data and recreate the schema? (yes/no): ' }, (error, answer) => {
                    if (error)
                        return this.error(error.message);

                    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y')
                        process.exit(0);

                    let proc = this._runner.spawn(
                        'psql',
                        [
                            '-U', this._config.get('postgres.main.user'),
                            '-d', this._config.get('postgres.main.db_name'),
                            '-h', this._config.get('postgres.main.host'),
                            '-p', this._config.get('postgres.main.port'),
                            '-W',
                            '-f', path.join(__dirname, '..', 'database', 'schema.sql'),
                        ],
                        {},
                        {
                            'assword.*:': this._config.get('postgres.main.password'),
                        }
                    );
                    proc.cmd.on('data', data => {
                        process.stdout.write(data);
                    });
                    proc.promise
                        .then(() => {
                            resolve();
                        })
                        .catch(error => {
                            reject(error);
                        });
                });
            })
            .then(() => {
                process.exit(0);
            })
            .catch(error => {
                return this.error(error.message);
            });
    }

    /**
     * Log error and terminate
     * @param {...*} args
     */
    error(...args) {
        return this._app.error(...args)
            .then(
                () => {
                    process.exit(1);
                },
                () => {
                    process.exit(1);
                }
            );
    }
}

module.exports = CreateDb;