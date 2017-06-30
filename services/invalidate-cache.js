/**
 * Invalidating cache service
 * @module services/invalidate-cache
 */

class InvalidateCache {
    /**
     * Create the service
     * @param {PubSub} pubsub                   PostgresPubSub service
     * @param {Cacher} cacher                   Cacher service
     * @param {Logger} logger                   Logger service
     */
    constructor(pubsub, cacher, logger) {
        this._started = false;
        this._pubsub = pubsub;
        this._cacher = cacher;
        this._logger = logger;
    }

    /**
     * Service name is 'invalidateCache'
     * @type {string}
     */
    static get provides() {
        return 'invalidateCache';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'postgresPubSub', 'cacher', 'logger' ];
    }

    /**
     * This service is a singleton
     * @type {string}
     */
    static get lifecycle() {
        return 'singleton';
    }

    /**
     * Initialize the subscriber
     * @return {Promise}
     */
    register() {
        if (this._started)
            return Promise.resolve();

        this._started = true;
        return this._pubsub.connect('main', 'InvalidateCache')
            .then(client => {
                return client.subscribe("invalidate_cache", this.onMessage.bind(this));
            });
    }

    /**
     * PUBSUB message handler
     * @param {*} message                       Body of the message
     */
    onMessage(message) {
        if (typeof message !== 'object' || typeof message.key !== 'string')
            this._logger.error('Received invalid cache invalidation message', message);

        this._cacher.unset('sql:' + message.key)
            .catch(error => {
                this._logger.error('Invalidation of the cache failed', error);
            });
    }
}

module.exports = InvalidateCache;
