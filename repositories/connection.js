/**
 * Connection repository
 * @module repositories/connection
 */
const path = require('path');
const BaseRepository = require('./base');

/**
 * Connection repository class
 */
class ConnectionRepository extends BaseRepository {
    /**
     * Create repository
     * @param {App} app                             The application
     * @param {object} config                       Configuration service
     * @param {Postgres} postgres                   Postgres service
     * @param {Cacher} cacher                       Cacher service
     * @param {Util} util                           Util service
     */
    constructor(app, config, postgres, cacher, util) {
        super(app, postgres, util);
        this._config = config;
        this._cacher = cacher;

        this._loadMethods(path.join(__dirname, 'connection'));
    }

    /**
     * Service name is 'repositories.connection'
     * @type {string}
     */
    static get provides() {
        return 'repositories.connection';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'postgres', 'cacher', 'util' ];
    }

    /**
     * Generate connection token
     * @return {string}
     */
    generateToken() {
        return this._util.getRandomString(32, { lower: true, upper: true, digits: true });
    }
}

module.exports = ConnectionRepository;
