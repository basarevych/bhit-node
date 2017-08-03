/**
 * Registry Client Connection Entity
 * @module entities/registry-client-connection
 */

/**
 * Registry Client Connection Entity
 */
class RegistryClientConnection {
    /**
     * Create entity
     * @param {string} name
     */
    constructor(name) {
        this._name = name;
        this._server = null;                // boolean flag
        this._connected = 0;                // peers connected
    }

    /**
     * Service name is 'entities.registryClientConnection'
     * @type {string}
     */
    static get provides() {
        return 'entities.registryClientConnection';
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
     * @param {boolean} server
     */
    set server(server) {
        this._server = server;
    }

    /**
     * Server getter
     * @type {boolean}
     */
    get server() {
        return this._server;
    }

    /**
     * Connected setter
     * @param {number} connected
     */
    set connected(connected) {
        this._connected = connected;
    }

    /**
     * Connected getter
     * @type {number}
     */
    get connected() {
        return this._connected;
    }
}

module.exports = RegistryClientConnection;
