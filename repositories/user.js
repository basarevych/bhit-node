/**
 * User repository
 * @module repositories/user
 */
const path = require('path');
const BaseRepository = require('arpen/src/repositories/base');

/**
 * User repository class
 */
class UserRepository extends BaseRepository {
    /**
     * Create repository
     * @param {App} app                             The application
     * @param {Postgres} postgres                   Postgres service
     * @param {Cacher} cacher                       Cacher service
     * @param {Util} util                           Util service
     */
    constructor(app, postgres, cacher, util) {
        super(app, postgres, cacher, util);
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
     * DB table name
     * @type {string}
     */
    static get table() {
        return 'users';
    }

    /**
     * Model name
     * @type {string}
     */
    static get model() {
        return 'user';
    }

    /**
     * Generate user token
     * @return {string}
     */
    generateToken() {
        return this._util.getRandomString(32, { lower: true, upper: true, digits: true });
    }
}

module.exports = UserRepository;
