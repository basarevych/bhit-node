/**
 * Path repository
 * @module repositories/path
 */
const path = require('path');
const Repository = require('./base');

/**
 * Path repository class
 */
class PathRepository extends Repository {
    /**
     * Create repository
     * @param {App} app                             The application
     * @param {object} config                       Configuration service
     * @param {Postgres} postgres                   Postgres service
     * @param {Cacher} cacher                       Cacher service
     * @param {Util} util                           Util service
     * @param {PathModel} model                     Path model
     */
    constructor(app, config, postgres, cacher, util, model) {
        super(app, postgres, util, model);
        this._config = config;
        this._cacher = cacher;

        this._loadMethods(path.join(__dirname, 'path'));
    }

    /**
     * Service name is 'repositories.path'
     * @type {string}
     */
    static get provides() {
        return 'repositories.path';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'postgres', 'cacher', 'util', 'models.path' ];
    }
}

module.exports = PathRepository;
