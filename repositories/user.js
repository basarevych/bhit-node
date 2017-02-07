/**
 * User repository
 * @module repositories/user
 */
const path = require('path');
const Repository = require('./base');

/**
 * User repository class
 */
class UserRepository extends Repository {
    /**
     * Create repository
     * @param {App} app                             The application
     * @param {object} config                       Configuration service
     * @param {Postgres} postgres                   Postgres service
     * @param {Cacher} cacher                       Cacher service
     * @param {Util} util                           Util service
     * @param {UserModel} model                     User model
     */
    constructor(app, config, postgres, cacher, util, model) {
        super(app, postgres, util, model);
        this._config = config;
        this._cacher = cacher;

        this._loadMethods(path.join(__dirname, 'user'));
    }

    /**
     * Service name is 'repositories.user'
     * @type {string}
     */
    static get provides() {
        return 'repositories.user';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'postgres', 'cacher', 'util', 'models.user' ];
    }
}

module.exports = UserRepository;
