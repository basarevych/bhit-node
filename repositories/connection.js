/**
 * Connection repository
 * @module repositories/connection
 */
const path = require('path');
const Repository = require('./base');

/**
 * Connection repository class
 */
class ConnectionRepository extends Repository {
    /**
     * Create repository
     * @param {App} app                             The application
     * @param {object} config                       Configuration service
     * @param {Postgres} postgres                   Postgres service
     * @param {Cacher} cacher                       Cacher service
     * @param {Util} util                           Util service
     * @param {ConnectionModel} model                     Connection model
     */
    constructor(app, config, postgres, cacher, util, model) {
        super(app, postgres, util, model);
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
        return [ 'app', 'config', 'postgres', 'cacher', 'util', 'models.connection' ];
    }
}

module.exports = ConnectionRepository;
