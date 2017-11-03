/**
 * Stop command
 * @module commands/stop
 */
const path = require('path');
const argvParser = require('argv');

/**
 * Command class
 */
class Stop {
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
     * Service name is 'commands.stop'
     * @type {string}
     */
    static get provides() {
        return 'commands.stop';
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
            await this.terminate();
            return 0;
        } catch (error) {
            await this.error(error);
        }
    }

    /**
     * Kill the daemon and wait for exit
     * @return {Promise}
     */
    async terminate() {
        let result = await this._runner.exec(path.join(__dirname, '..', 'bin', 'status'));
        if (result.code === 0) {
            return this._runner.exec(
                path.join(__dirname, '..', 'bin', 'kill'),
                ['SIGTERM'],
                { pipe: process }
            );
        }

        return new Promise(async (resolve, reject) => {
            let tries = 0;
            let waitExit = async () => {
                try {
                    let result = await this._runner.exec(path.join(__dirname, '..', 'bin', 'status'));
                    if (result.code === 100)
                        return resolve();

                    if (result.code !== 0)
                        return reject('Could not get daemon status');

                    if (++tries > 60)
                        return reject('Daemon would not exit');

                    setTimeout(waitExit, 500);
                } catch (error) {
                    reject(error);
                }
            };

            return waitExit();
        });
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

module.exports = Stop;
