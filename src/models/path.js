/**
 * Path model
 * @module models/path
 */
const BaseModel = require('arpen/src/models/postgres');

/**
 * Path model class
 */
class PathModel extends BaseModel {
    /**
     * Create model
     * @param {Postgres} postgres       Postgres service
     * @param {Util} util               Util service
     */
    constructor(postgres, util) {
        super(postgres, util);

        this._addField('parent_id', 'parentId');
        this._addField('user_id', 'userId');
        this._addField('name', 'name');
        this._addField('path', 'path');
        this._addField('token', 'token');
    }

    /**
     * Service name is 'models.path'
     * @type {string}
     */
    static get provides() {
        return 'models.path';
    }

    /**
     * Parent ID setter
     * @type {undefined|number}
     */
    set parentId(id) {
        return this._setField('parent_id', id);
    }

    /**
     * Parent ID getter
     * @type {undefined|number}
     */
    get parentId() {
        return this._getField('parent_id');
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
     * Path setter
     * @type {undefined|string}
     */
    set path(path) {
        return this._setField('path', path);
    }

    /**
     * Path getter
     * @type {undefined|string}
     */
    get path() {
        return this._getField('path');
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
}

module.exports = PathModel;
