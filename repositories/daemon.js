/**
 * Daemon repository
 * @module repositories/daemon
 */
const path = require('path');
const BaseRepository = require('arpen/src/repositories/base');

/**
 * Daemon repository class
 */
class DaemonRepository extends BaseRepository {
    /**
     * Create repository
     * @param {App} app                             The application
     * @param {Postgres} postgres                   Postgres service
     * @param {Cacher} cacher                       Cacher service
     * @param {Util} util                           Util service
     */
    constructor(app, postgres, cacher, util) {
        super(app, postgres, cacher, util);
        this._loadMethods(path.join(__dirname, 'daemon'));
    }

    /**
     * Service name is 'repositories.daemon'
     * @type {string}
     */
    static get provides() {
        return 'repositories.daemon';
    }

    /**
     * DB table name
     * @type {string}
     */
    static get table() {
        return 'daemons';
    }

    /**
     * Model name
     * @type {string}
     */
    static get model() {
        return 'daemon';
    }

    /**
     * Generate daemon token
     * @return {string}
     */
    generateToken() {
        return this._util.getRandomString(32, { lower: true, upper: true, digits: true });
    }
}

module.exports = DaemonRepository;
