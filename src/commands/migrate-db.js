/**
 * Migrate DB command
 * @module commands/migrate
 */
const path = require('path');
const fs = require('fs');
const argvParser = require('argv');

/**
 * Command class
 */
class MigrateDb {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} config           Configuration
     * @param {Postgres} postgres       Postgres service
     */
    constructor(app, config, postgres) {
        this._app = app;
        this._config = config;
        this._postgres = postgres;
    }

    /**
     * Service name is 'commands.migrateDb'
     * @type {string}
     */
    static get provides() {
        return 'commands.migrateDb';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'postgres' ];
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
        const latestVersion = 1;

        try {
            let client = await this._postgres.connect(instance);
            let currentVersion = 0;
            try {
                let result = await client.query(
                    `SELECT value 
                       FROM _info
                      WHERE name = 'schema_version'`
                );
                currentVersion = result.rowCount ? parseInt(result.rows[0].value) : 0;
            } catch (error) {
                // do nothing
            }
            client.done();

            let deltas = [];
            for (let i = currentVersion + 1; i <= latestVersion; i++)
                deltas.push(`schema.${i}.sql`);

            await deltas.reduce(
                async (prev, cur) => {
                    await prev;

                    let filename = path.join(__dirname, '..', '..', 'database', cur);
                    try {
                        fs.accessSync(filename, fs.constants.F_OK);
                    } catch (error) {
                        return; // skip
                    }

                    await this._app.info(`==> ${path.basename(filename)}\n`);
                    return this._postgres.exec(filename, instance);
                },
                Promise.resolve()
            );

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

module.exports = MigrateDb;
