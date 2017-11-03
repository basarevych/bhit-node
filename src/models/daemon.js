/**
 * Daemon model
 * @module models/daemon
 */
const moment = require('moment-timezone');
const BaseModel = require('arpen/src/models/postgres');

/**
 * Daemon model class
 */
class DaemonModel extends BaseModel {
    /**
     * Create model
     * @param {Postgres} postgres       Postgres service
     * @param {Util} util               Util service
     */
    constructor(postgres, util) {
        super(postgres, util);

        this._addField('user_id', 'userId');
        this._addField('name', 'name');
        this._addField('acting_as', 'actingAs');
        this._addField('token', 'token');
        this._addField('created_at', 'createdAt');
        this._addField('blocked_at', 'blockedAt');
    }

    /**
     * Service name is 'models.daemon'
     * @type {string}
     */
    static get provides() {
        return 'models.daemon';
    }

    /**
     * User ID setter
     * @type {undefined|number}
     */
    set userId(id) {
        return this._setField('user_id', id);
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
     * Acting type setter
     * @type {undefined|string}
     */
    set actingAs(type) {
        return this._setField('acting_as', type);
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

    /**
     * Convert to object. Dates are converted to strings in UTC timezone
     * @param {string[]} [fields]                       Fields to save
     * @param {object} [options]                        Options
     * @param {string|null} [options.timeZone='UTC']    DB time zone
     * @return {object}                                 Returns serialized object
     */
    _serialize(fields, options = {}) {
        if (!fields) {
            fields = Array.from(this._fields.keys())
                .filter(field => {
                    return field !== 'acting_as';
                });
        }

        return super._serialize(fields, options);
    }
}

module.exports = DaemonModel;
