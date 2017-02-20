/**
 * Clear cache command
 * @module commands/clear-cache
 */
const debug = require('debug')('bhit:command');
const path = require('path');
const fs = require('fs');

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
     * @param {object} argv             Minimist object
     * @return {Promise}
     */
    run(argv) {
        return this._redis.connect(this._config.get('cache.redis'))
            .then(client => {
                return client.query('FLUSHDB')
                    .then(() => {
                        client.done();
                    })
            })
            .catch(error => {
                this.error(error.message);
            });
    }

    /**
     * Log error and terminate
     * @param {...*} args
     */
    error(...args) {
        console.error(...args);
        process.exit(1);
    }
}

module.exports = ClearCache;