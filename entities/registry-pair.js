/**
 * Registry Pair Entity
 * @module entities/registry-pair
 */

/**
 * Registry Daemon Entity
 */
class RegistryDaemon {
    /**
     * Create entity
     * @param {string} serverRequestId
     * @param {string} clientRequestId
     */
    constructor(serverRequestId, clientRequestId) {
        this._timeout = 0;
        this._connectionName = null;
        this._serverRequestId = serverRequestId;
        this._serverId = null;
        this._serverAddress = null;
        this._serverPort = null;
        this._clientRequestId = clientRequestId;
        this._clientId = null;
        this._clientAddress = null;
        this._clientPort = null;
    }

    /**
     * Service name is 'entities.registryPair'
     * @type {string}
     */
    static get provides() {
        return 'entities.registryPair';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [];
    }

    /**
     * Server Request ID getter
     * @type {string}
     */
    get serverRequestId() {
        return this._serverRequestId;
    }

    /**
     * Server ID setter
     * @param {string} serverId
     */
    set serverId(serverId) {
        this._serverId = serverId;
    }

    /**
     * Server ID getter
     * @type {string}
     */
    get serverId() {
        return this._serverId;
    }

    /**
     * Server Address setter
     * @param {string} serverAddress
     */
    set serverAddress(serverAddress) {
        this._serverAddress = serverAddress;
    }

    /**
     * Server Address getter
     * @type {string}
     */
    get serverAddress() {
        return this._serverAddress;
    }

    /**
     * Server Port setter
     * @param {string} serverPort
     */
    set serverPort(serverPort) {
        this._serverPort = serverPort;
    }

    /**
     * Server Port getter
     * @type {string}
     */
    get serverPort() {
        return this._serverPort;
    }

    /**
     * Client Request ID getter
     * @type {string}
     */
    get clientRequestId() {
        return this._clientRequestId;
    }

    /**
     * Client ID setter
     * @param {string} clientId
     */
    set clientId(clientId) {
        this._clientId = clientId;
    }

    /**
     * Client ID getter
     * @type {string}
     */
    get clientId() {
        return this._clientId;
    }

    /**
     * Client Address setter
     * @param {string} clientAddress
     */
    set clientAddress(clientAddress) {
        this._clientAddress = clientAddress;
    }

    /**
     * Client Address getter
     * @type {string}
     */
    get clientAddress() {
        return this._clientAddress;
    }

    /**
     * Client Port setter
     * @param {string} clientPort
     */
    set clientPort(clientPort) {
        this._clientPort = clientPort;
    }

    /**
     * Client Port getter
     * @type {string}
     */
    get clientPort() {
        return this._clientPort;
    }

    /**
     * Timeout setter
     * @param {number} timeout
     */
    set timeout(timeout) {
        this._timeout = timeout;
    }

    /**
     * Timeout getter
     * @type {number}
     */
    get timeout() {
        return this._timeout;
    }

    /**
     * Connection name setter
     * @param {string} connectionName
     */
    set connectionName(connectionName) {
        this._connectionName = connectionName;
    }

    /**
     * Connection name getter
     * @type {string}
     */
    get connectionName() {
        return this._connectionName;
    }
}

module.exports = RegistryDaemon;
