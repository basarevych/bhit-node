/**
 * User model
 * @module models/user
 */
const Model = require('./base');

/**
 * User model class
 */
class UserModel extends Model {
    /**
     * Create model
     */
    constructor() {
        super();

        this.id = undefined;
        this.name = undefined;
        this.email = undefined;
        this.token = undefined;
        this.confirm = undefined;
        this.password = undefined;
        this.createdAt = undefined;
        this.confirmedAt = undefined;
        this.blockedAt = undefined;
    }

    /**
     * Service name is 'models.user'
     * @type {string}
     */
    static get provides() {
        return 'models.user';
    }

    /**
     * Minimum password length
     */
    static get minPasswordLength() {
        return 6;
    }

    /**
     * ID setter
     * @type {undefined|number}
     */
    set id(id) {
        this._setField('id', id);
    }

    /**
     * ID getter
     * @type {undefined|number}
     */
    get id() {
        return this._getField('id');
    }

    /**
     * Name setter
     * @type {undefined|string|null}
     */
    set name(name) {
        this._setField('name', name);
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
        this._setField('email', email);
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
        this._setField('token', token);
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
        this._setField('confirm', confirm);
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
        this._setField('password', password);
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
        this._setField('created_at', createdAt);
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
        this._setField('confirmed_at', confirmedAt);
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
        this._setField('blocked_at', blockedAt);
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
