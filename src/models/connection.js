/**
 * Connection model
 * @module models/connection
 */
const BaseModel = require('arpen/src/models/postgres');

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

        this._addField('user_id', 'userId');
        this._addField('path_id', 'pathId');
        this._addField('token', 'token');
        this._addField('encrypted', 'encrypted');
        this._addField('fixed', 'fixed');
        this._addField('connect_address', 'connectAddress');
        this._addField('connect_port', 'connectPort');
        this._addField('listen_address', 'listenAddress');
        this._addField('listen_port', 'listenPort');
        this._addField('acting_as', 'actingAs');
        this._addField('address_override', 'addressOverride');
        this._addField('port_override', 'portOverride');
    }

    /**
     * Service name is 'models.connection'
     * @type {string}
     */
    static get provides() {
        return 'models.connection';
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
     * @param {string[]} [fields]                       Fields to save
     * @param {object} [options]                        Options
     * @param {string|null} [options.timeZone='UTC']    DB time zone
     * @return {object}                                 Returns serialized object
     */
    _serialize(fields, options = {}) {
        if (!fields) {
            fields = Array.from(this._fields.keys())
                .filter(field => {
                    return !['acting_as', 'address_override', 'port_override'].includes(field);
                });
        }

        return super._serialize(fields, options);
    }
}

module.exports = ConnectionModel;
