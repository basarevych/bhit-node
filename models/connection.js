/**
 * Connection model
 * @module models/connection
 */
const Model = require('./base');

/**
 * Connection model class
 */
class ConnectionModel extends Model {
    /**
     * Create model
     */
    constructor() {
        super();

        this.id = undefined;
        this.userId = undefined;
        this.pathId = undefined;
        this.token = undefined;
        this.encrypted = undefined;
        this.fixed = undefined;
        this.connectAddress = undefined;
        this.connectPort = undefined;
        this.listenAddress = undefined;
        this.listenPort = undefined;
        this.actingAs = undefined;
        this.addressOverride = undefined;
        this.portOverride = undefined;
    }

    /**
     * Service name is 'models.connection'
     * @type {string}
     */
    static get provides() {
        return 'models.connection';
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
     * Path ID setter
     * @type {undefined|number}
     */
    set pathId(id) {
        this._setField('path_id', id);
    }

    /**
     * Path ID getter
     * @type {undefined|number}
     */
    get pathId() {
        return this._getField('path_id');
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
     * Encrypted setter
     * @type {undefined|boolean}
     */
    set encrypted(encrypted) {
        this._setField('encrypted', encrypted);
    }

    /**
     * Encrypted getter
     * @type {undefined|boolean}
     */
    get encrypted() {
        return this._getField('encrypted');
    }

    /**
     * Fixed setter
     * @type {undefined|boolean}
     */
    set fixed(fixed) {
        this._setField('fixed', fixed);
    }

    /**
     * Fixed getter
     * @type {undefined|boolean}
     */
    get fixed() {
        return this._getField('fixed');
    }

    /**
     * Connect address setter
     * @type {undefined|string|null}
     */
    set connectAddress(address) {
        this._setField('connect_address', address);
    }

    /**
     * Connect address getter
     * @type {undefined|string|null}
     */
    get connectAddress() {
        return this._getField('connect_address');
    }

    /**
     * Connect port setter
     * @type {undefined|string}
     */
    set connectPort(port) {
        this._setField('connect_port', port);
    }

    /**
     * Connect port getter
     * @type {undefined|string}
     */
    get connectPort() {
        return this._getField('connect_port');
    }

    /**
     * Listen address setter
     * @type {undefined|string|null}
     */
    set listenAddress(address) {
        this._setField('listen_address', address);
    }

    /**
     * Listen address getter
     * @type {undefined|string|null}
     */
    get listenAddress() {
        return this._getField('listen_address');
    }

    /**
     * Listen port setter
     * @type {undefined|string|null}
     */
    set listenPort(port) {
        this._setField('listen_port', port);
    }

    /**
     * Listen port getter
     * @type {undefined|string|null}
     */
    get listenPort() {
        return this._getField('listen_port');
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
     * Address override setter
     * @type {undefined|string|null}
     */
    set addressOverride(address) {
        this._setField('address_override', address);
    }

    /**
     * Address override getter
     * @type {undefined|string|null}
     */
    get addressOverride() {
        return this._getField('address_override');
    }

    /**
     * Port override setter
     * @type {undefined|string|null}
     */
    set portOverride(port) {
        this._setField('port_override', port);
    }

    /**
     * Port override getter
     * @type {undefined|string|null}
     */
    get portOverride() {
        return this._getField('port_override');
    }
}

module.exports = ConnectionModel;
