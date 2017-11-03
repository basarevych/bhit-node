/**
 * Clear cache command
 * @module commands/clear-cache
 */
const argvParser = require('argv');

/**
 * Command class
 */
class ClearCache {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} config           Configuration
     * @param {Redis} redis             Redis service
     */
    constructor(app, config, redis) {
        this._app = app;
        this._config = config;
        this._redis = redis;
    }

    /**
     * Service name is 'commands.clearCache'
     * @type {string}
     */
    static get provides() {
        return 'commands.clearCache';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'redis' ];
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
            let client = await this._redis.connect(this._config.get('cache.redis'));
            await client.query('FLUSHDB');
            client.done();
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

module.exports = ClearCache;
