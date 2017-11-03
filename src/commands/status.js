/**
 * Status command
 * @module commands/status
 */
const path = require('path');
const argvParser = require('argv');

/**
 * Command class
 */
class Status {
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
     * Service name is 'commands.status'
     * @type {string}
     */
    static get provides() {
        return 'commands.status';
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
    async run(argv) {
        argvParser
            .option({
                name: 'help',
                short: 'h',
                type: 'boolean',
            })
            .run(argv);

        try {
            return await this._runner.exec(
                path.join(__dirname, '..', 'bin', 'status'),
                [],
                { pipe: process }
            );
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

module.exports = Status;
