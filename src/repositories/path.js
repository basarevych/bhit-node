/**
 * Path repository
 * @module repositories/path
 */
const path = require('path');
const BaseRepository = require('arpen/src/repositories/postgres');

/**
 * Path repository class
 */
class PathRepository extends BaseRepository {
    /**
     * Create repository
     * @param {App} app                             The application
     * @param {Postgres} postgres                   Postgres service
     * @param {Cacher} cacher                       Cacher service
     * @param {Util} util                           Util service
     */
    constructor(app, postgres, cacher, util) {
        super(app, postgres, cacher, util);
        this._loadMethods(path.join(__dirname, 'path'));
        this._enableCache = true;
    }

    /**
     * Service name is 'repositories.path'
     * @type {string}
     */
    static get provides() {
        return 'repositories.path';
    }

    /**
     * DB table name
     * @type {string}
     */
    static get table() {
        return 'paths';
    }

    /**
     * Model name
     * @type {string}
     */
    static get model() {
        return 'path';
    }

    /**
     * Generate path token
     * @return {string}
     */
    generateToken() {
        return this._util.getRandomString(32, { lower: true, upper: true, digits: true });
    }
}

module.exports = PathRepository;
