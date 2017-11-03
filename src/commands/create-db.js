/**
 * Create DB command
 * @module commands/create-db
 */
const argvParser = require('argv');

/**
 * Command class
 */
class CreateDb {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} config           Configuration
     * @param {Filer} filer             Filer service
     * @param {Postgres} postgres       Postgres service
     * @param {Util} util               Util service
     */
    constructor(app, config, filer, postgres, util) {
        this._app = app;
        this._config = config;
        this._filer = filer;
        this._postgres = postgres;
        this._util = util;
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
        return [ 'app', 'config', 'filer', 'postgres', 'util' ];
    }

    /**
     * Run the command
     * @param {string[]} argv           Arguments
     * @return {Promise}
     */
    async run(argv) {
        argvParser
            .option({
                name: 'help',
                short: 'h',
                type: 'boolean',
            })
            .run(argv);

        const instance = 'main';

        try {
            let filename = '/tmp/arpen.db.' + this._util.getRandomString(16);
            let sql = `create user ${this._config.get(`postgres.${instance}.user`)} with password '${this._config.get(`postgres.${instance}.password`)}';
                       create database ${this._config.get(`postgres.${instance}.database`)};
                       grant all privileges on database ${this._config.get(`postgres.${instance}.database`)} to ${this._config.get(`postgres.${instance}.user`)};`;
            await this._filer.lockWrite(filename, sql);

            await this._postgres.exec(
                filename,
                {
                    host: this._config.get(`postgres.${instance}.host`),
                    port: this._config.get(`postgres.${instance}.port`),
                    database: 'postgres',
                }
            );

            await this._filer.remove(filename);
            return 0;
        } catch (error) {
            await this.error(error);
        }
    }

    /**
     * Log error and terminate
     * @param {...*} args
     * @return {Promise}
     */
    async error(...args) {
        try {
            await args.reduce(
                async (prev, cur) => {
                    await prev;
                    return this._app.error(cur.fullStack || cur.stack || cur.message || cur);
                },
                Promise.resolve()
            );
        } catch (error) {
            // do nothing
        }
        process.exit(1);
    }
}

module.exports = CreateDb;
