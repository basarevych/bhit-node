/**
 * Daemon repository
 * @module repositories/daemon
 */
const path = require('path');
const BaseRepository = require('arpen/src/repositories/postgres');

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
     * @param {Registry} registry                   Registry service
     */
    constructor(app, postgres, cacher, util, registry) {
        super(app, postgres, cacher, util);
        this._registry = registry;
        this._loadMethods(path.join(__dirname, 'daemon'));
        this._enableCache = true;
    }

    /**
     * Service name is 'repositories.daemon'
     * @type {string}
     */
    static get provides() {
        return 'repositories.daemon';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'postgres', 'cacher', 'util', 'registry' ];
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
