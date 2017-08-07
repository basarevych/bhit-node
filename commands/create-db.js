/**
 * Create DB command
 * @module commands/create-db
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
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
     * @param {Ini} ini                 Ini service
     */
    constructor(app, config, runner, ini) {
        this._app = app;
        this._config = config;
        this._runner = runner;
        this._ini = ini;
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
        return [ 'app', 'config', 'runner', 'ini' ];
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
            .option({
                name: 'user',
                short: 'u',
                type: 'string',
            })
            .run(argv);

        const instance = 'main';

        return Promise.resolve()
            .then(() => {
                if (process.getuid())
                    throw new Error('Run this command as root');
            })
            .then(() => {
                let configDir, config;
                if (os.platform() === 'freebsd') {
                    configDir = '/usr/local/etc/bhit';
                    this._app.debug(`Platform: FreeBSD`);
                } else {
                    configDir = '/etc/bhit';
                    this._app.debug(`Platform: Linux`);
                }

                try {
                    config = this._ini.parse(fs.readFileSync(path.join(configDir, 'bhit.conf'), 'utf8'));
                } catch (error) {
                    throw new Error(`Could not read bhit.conf`);
                }

                function get(key) {
                    return key.split('.').reduce((prev, cur) => {
                        if (!prev)
                            return prev;
                        return prev[cur];
                    }, config);
                }

                let suOptions;
                if (os.platform() === 'freebsd') {
                    suOptions = [
                        '-m', args.options.user || 'pgsql',
                        '-c', `psql -h ${get(`postgres.host`)} -d postgres -f -`
                    ];
                } else {
                    suOptions = [
                        '-c',
                        `psql -h ${get(`postgres.host`)} -d postgres -f -`,
                        args.options.user || 'postgres'
                    ];
                }

                let sql = `create user ${get(`postgres.user`)} with password '${get(`postgres.password`)}';
                           create database ${get(`postgres.db_name`)};
                           grant all privileges on database ${get(`postgres.db_name`)} to ${get(`postgres.user`)};
                           \\q`;

                let promise = this._runner.exec('su', suOptions, { pipe: process });
                process.stdin.emit('data', sql + '\n');
                return promise;
            })
            .then(result => {
                process.exit(result.code);
            })
            .catch(error => {
                return this.error(error);
            });
    }

    /**
     * Log error and terminate
     * @param {...*} args
     */
    error(...args) {
        return args.reduce(
            (prev, cur) => {
                return prev.then(() => {
                    return this._app.error(cur.fullStack || cur.stack || cur.message || cur);
                });
            },
            Promise.resolve()
            )
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