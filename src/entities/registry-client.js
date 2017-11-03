/**
 * Registry Client Entity
 * @module entities/registry-client
 */

/**
 * Registry Client Entity
 */
class RegistryClient {
    /**
     * Create entity
     * @param {string} id
     */
    constructor(id) {
        this._id = id;
        this._identity = null;          // hash of the key currently
        this._key = null;               // public key
        this._hostname = '?';
        this._version = '?';
        this._daemonId = null;
        this._ips = new Set();          // internal IPs
        this._connections = new Map();  // name -> RegistryClientConnection
    }

    /**
     * Service name is 'entities.registryClient'
     * @type {string}
     */
    static get provides() {
        return 'entities.registryClient';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [];
    }

    /**
     * ID getter
     * @type {string}
     */
    get id() {
        return this._id;
    }

    /**
     * Identity setter
     * @param {string} identity
     */
    set identity(identity) {
        this._identity = identity;
    }

    /**
     * Identity getter
     * @type {string}
     */
    get identity() {
        return this._identity;
    }

    /**
     * Key setter
     * @param {string} key
     */
    set key(key) {
        this._key = key;
    }

    /**
     * Key getter
     * @type {string}
     */
    get key() {
        return this._key;
    }

    /**
     * Hostname setter
     * @param {string} hostname
     */
    set hostname(hostname) {
        this._hostname = hostname;
    }

    /**
     * Hostname getter
     * @type {string}
     */
    get hostname() {
        return this._hostname;
    }

    /**
     * Version setter
     * @param {string} version
     */
    set version(version) {
        this._version = version;
    }

    /**
     * Version getter
     * @type {string}
     */
    get version() {
        return this._version;
    }

    /**
     * Daemon ID setter
     * @param {number} daemonId
     */
    set daemonId(daemonId) {
        this._daemonId = daemonId;
    }

    /**
     * Daemon ID getter
     * @type {number}
     */
    get daemonId() {
        return this._daemonId;
    }

    /**
     * IPs getter
     * @type {Set}
     */
    get ips() {
        return this._ips;
    }

    /**
     * Connections getter
     * @return {Map}
     */
    get connections() {
        return this._connections;
    }
}

module.exports = RegistryClient;
