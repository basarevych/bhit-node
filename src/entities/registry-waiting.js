/**
 * Registry Waiting Entity
 * @module entities/registry-waiting
 */

/**
 * Registry Waiting Entity
 */
class RegistryWaiting {
    /**
     * Create entity
     * @param {string} name
     */
    constructor(name) {
        this._name = name;
        this._server = null;                        // client ID
        this._internalAddresses = [];               // [protobuf InternalAddress]
        this._clients = new Set();                  // of IDs
    }

    /**
     * Service name is 'entities.registryWaiting'
     * @type {string}
     */
    static get provides() {
        return 'entities.registryWaiting';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [];
    }

    /**
     * Name getter
     * @type {string}
     */
    get name() {
        return this._name;
    }

    /**
     * Server setter
     * @param {string} server
     */
    set server(server) {
        this._server = server;
    }

    /**
     * Server getter
     * @type {string}
     */
    get server() {
        return this._server;
    }

    /**
     * User ID setter
     * @param {number} userId
     */
    set userId(userId) {
        this._userId = userId;
    }

    /**
     * User ID getter
     * @type {number}
     */
    get userId() {
        return this._userId;
    }

    /**
     * Internal Addresses setter
     * @param {object[]} internalAddresses
     */
    set internalAddresses(internalAddresses) {
        this._internalAddresses = internalAddresses;
    }

    /**
     * Internal Addresses getter
     * @type {object[]}
     */
    get internalAddresses() {
        return this._internalAddresses;
    }

    /**
     * Clients getter
     * @type {Set}
     */
    get clients() {
        return this._clients;
    }
}

module.exports = RegistryWaiting;
