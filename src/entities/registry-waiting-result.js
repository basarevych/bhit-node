/**
 * Registry Waiting Result Entity
 * @module entities/registry-waiting-result
 */

/**
 * Registry Waiting Result Entity
 */
class RegistryWaitingResult {
    /**
     * Create entity
     * @param {RegistryWaiting} waiting
     * @param {RegistryDaemon} daemon
     */
    constructor(waiting, daemon) {
        this._connectionName = waiting.name;
        this._daemonName = daemon.userEmail + '?' + daemon.name;
        this._internalAddresses = waiting.internalAddresses.slice();
        this._targets = Array.from(waiting.clients).slice();
    }

    /**
     * Service name is 'entities.registryWaitingResult'
     * @type {string}
     */
    static get provides() {
        return 'entities.registryWaitingResult';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [];
    }

    /**
     * Info getter
     * @type {object}
     */
    get info() {
        return {
            connectionName: this._connectionName,
            daemonName: this._daemonName,
            internalAddresses: this._internalAddresses,
        };
    }

    /**
     * targets getter
     * @type {string[]}
     */
    get targets() {
        return this._targets;
    }
}

module.exports = RegistryWaitingResult;
