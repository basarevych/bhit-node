/**
 * Connection model
 * @module models/connection
 */
const BaseModel = require('arpen/src/models/base');

/**
 * Connection model class
 */
class ConnectionModel extends BaseModel {
    /**
     * Create model
     * @param {Postgres} postgres       Postgres service
     * @param {Util} util               Util service
     */
    constructor(postgres, util) {
        super(postgres, util);

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
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'postgres', 'util' ];
    }

    /**
     * ID setter
     * @type {undefined|number}
     */
    set id(id) {
        return this._setField('id', id);
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
     * Path ID setter
     * @type {undefined|number}
     */
    set pathId(id) {
        return this._setField('path_id', id);
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
     * Encrypted setter
     * @type {undefined|boolean}
     */
    set encrypted(encrypted) {
        return this._setField('encrypted', encrypted);
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
        return this._setField('fixed', fixed);
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
        return this._setField('connect_address', address);
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
        return this._setField('connect_port', port);
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
        return this._setField('listen_address', address);
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
        return this._setField('listen_port', port);
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
     * Address override setter
     * @type {undefined|string|null}
     */
    set addressOverride(address) {
        return this._setField('address_override', address);
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
        return this._setField('port_override', port);
    }

    /**
     * Port override getter
     * @type {undefined|string|null}
     */
    get portOverride() {
        return this._getField('port_override');
    }

    /**
     * Convert to object. Dates are converted to strings in UTC timezone
     * @param {string[]} [fields]       Fields to save
     * @return {object}                 Returns serialized object
     */
    _serialize(fields) {
        if (!fields) {
            fields = Array.from(this._fields.keys())
                .filter(field => {
                    return [ 'acting_as', 'address_override', 'port_override' ].indexOf(field) === -1;
                });
        }

        return super._serialize(fields);
    }
}

module.exports = ConnectionModel;
