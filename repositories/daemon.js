/**
 * Daemon repository
 * @module repositories/daemon
 */
const path = require('path');
const BaseRepository = require('./base');

/**
 * Daemon repository class
 */
class DaemonRepository extends BaseRepository {
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
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'postgres', 'cacher', 'util' ];
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
