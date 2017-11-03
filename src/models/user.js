/**
 * User model
 * @module models/user
 */
const moment = require('moment-timezone');
const BaseModel = require('arpen/src/models/postgres');

/**
 * User model class
 */
class UserModel extends BaseModel {
    /**
     * Create model
     * @param {Postgres} postgres       Postgres service
     * @param {Util} util               Util service
     */
    constructor(postgres, util) {
        super(postgres, util);

        this._addField('name', 'name');
        this._addField('email', 'email');
        this._addField('token', 'token');
        this._addField('confirm', 'confirm');
        this._addField('password', 'password');
        this._addField('created_at', 'createdAt');
        this._addField('confirmed_at', 'confirmedAt');
        this._addField('blocked_at', 'blockedAt');
    }

    /**
     * Service name is 'models.user'
     * @type {string}
     */
    static get provides() {
        return 'models.user';
    }

    /**
     * Name setter
     * @type {undefined|string|null}
     */
    set name(name) {
        return this._setField('name', name);
    }

    /**
     * Name getter
     * @type {undefined|string|null}
     */
    get name() {
        return this._getField('name');
    }

    /**
     * Email setter
     * @type {undefined|string}
     */
    set email(email) {
        return this._setField('email', email);
    }

    /**
     * Email getter
     * @type {undefined|string}
     */
    get email() {
        return this._getField('email');
    }

    /**
     * Token setter
     * @type {undefined|string}
     */
    set token(token) {
        return this._setField('token', token);
    }

    /**
     * Token getter
     * @type {undefined|string}
     */
    get token() {
        return this._getField('token');
    }

    /**
     * Confirm token setter
     * @type {undefined|string|null}
     */
    set confirm(confirm) {
        return this._setField('confirm', confirm);
    }

    /**
     * Confirm token getter
     * @type {undefined|string|null}
     */
    get confirm() {
        return this._getField('confirm');
    }

    /**
     * Password setter
     * @type {undefined|string}
     */
    set password(password) {
        return this._setField('password', password);
    }

    /**
     * Password getter
     * @type {undefined|string}
     */
    get password() {
        return this._getField('password');
    }

    /**
     * Creation time setter
     * @type {undefined|object}
     */
    set createdAt(createdAt) {
        return this._setField('created_at', createdAt && moment(createdAt));
    }

    /**
     * Creation time getter
     * @type {undefined|object}
     */
    get createdAt() {
        return this._getField('created_at');
    }

    /**
     * Confirm time setter
     * @type {undefined|object|null}
     */
    set confirmedAt(confirmedAt) {
        return this._setField('confirmed_at', confirmedAt && moment(confirmedAt));
    }

    /**
     * Confirm time getter
     * @type {undefined|object|null}
     */
    get confirmedAt() {
        return this._getField('confirmed_at');
    }

    /**
     * Block time setter
     * @type {undefined|object|null}
     */
    set blockedAt(blockedAt) {
        return this._setField('blocked_at', blockedAt && moment(blockedAt));
    }

    /**
     * Block time getter
     * @type {undefined|object|null}
     */
    get blockedAt() {
        return this._getField('blocked_at');
    }
}

module.exports = UserModel;
