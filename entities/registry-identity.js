/**
 * Registry Identity Entity
 * @module entities/registry-identity
 */

/**
 * Registry Identity Entity
 */
class RegistryIdentity {
    /**
     * Create entity
     * @param {string} identity
     */
    constructor(identity) {
        this._identity = identity;
        this._clients = new Set();                  // of IDs
    }

    /**
     * Service name is 'entities.registryIdentity'
     * @type {string}
     */
    static get provides() {
        return 'entities.registryIdentity';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [];
    }

    /**
     * Identity getter
     * @type {string}
     */
    get identity() {
        return this._identity;
    }

    /**
     * Clients getter
     * @type {Set}
     */
    get clients() {
        return this._clients;
    }
}

module.exports = RegistryIdentity;
