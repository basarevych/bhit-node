/**
 * Daemon model
 * @module models/daemon
 */
const Model = require('./base');

/**
 * Daemon model class
 */
class DaemonModel extends Model {
    /**
     * Create model
     */
    constructor() {
        super();

        this.id = undefined;
        this.userId = undefined;
        this.name = undefined;
        this.actingAs = undefined;
        this.token = undefined;
        this.createdAt = undefined;
        this.blockedAt = undefined;
    }

    /**
     * Service name is 'models.daemon'
     * @type {string}
     */
    static get provides() {
        return 'models.daemon';
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
     * User ID setter
     * @type {undefined|number}
     */
    set userId(id) {
        this._setField('user_id', id);
    }

    /**
     * User ID getter
     * @type {undefined|number}
     */
    get userId() {
        return this._getField('user_id');
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
     * Acting type setter
     * @type {undefined|string}
     */
    set actingAs(type) {
        this._setField('acting_as', type);
    }

    /**
     * Acting type getter
     * @type {undefined|string}
     */
    get actingAs() {
        return this._getField('acting_as');
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

module.exports = DaemonModel;
