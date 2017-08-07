/**
 * Connection repository
 * @module repositories/connection
 */
const path = require('path');
const BaseRepository = require('arpen/src/repositories/base');

/**
 * Connection repository class
 */
class ConnectionRepository extends BaseRepository {
    /**
     * Create repository
     * @param {App} app                             The application
     * @param {Postgres} postgres                   Postgres service
     * @param {Cacher} cacher                       Cacher service
     * @param {Util} util                           Util service
     */
    constructor(app, postgres, cacher, util) {
        super(app, postgres, cacher, util);
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
     * DB table name
     * @type {string}
     */
    static get table() {
        return 'connections';
    }

    /**
     * Model name
     * @type {string}
     */
    static get model() {
        return 'connection';
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
