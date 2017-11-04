/**
 * Clear cache command
 * @module commands/clear-cache
 */
const argvParser = require('argv');
const Base = require('./base');

/**
 * Command class
 */
class ClearCache extends Base {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} config           Configuration
     * @param {Redis} redis             Redis service
     */
    constructor(app, config, redis) {
        super(app);
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
}

module.exports = ClearCache;
