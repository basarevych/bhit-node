/**
 * Registry Daemon Entity
 * @module entities/registry-daemon
 */

/**
 * Registry Daemon Entity
 */
class RegistryDaemon {
    /**
     * Create entity
     * @param {string} id
     */
    constructor(id) {
        this._id = id;
        this._name = null;
        this._userId = null;
        this._userEmail = null;
        this._clients = new Set();                  // of IDs
    }

    /**
     * Service name is 'entities.registryDaemon'
     * @type {string}
     */
    static get provides() {
        return 'entities.registryDaemon';
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
     * Name setter
     * @param {string} name
     */
    set name(name) {
        this._name = name;
    }

    /**
     * Name getter
     * @type {string}
     */
    get name() {
        return this._name;
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
     * User Email setter
     * @param {string} userEmail
     */
    set userEmail(userEmail) {
        this._userEmail = userEmail;
    }

    /**
     * User Email getter
     * @type {string}
     */
    get userEmail() {
        return this._userEmail;
    }

    /**
     * Clients getter
     * @type {Set}
     */
    get clients() {
        return this._clients;
    }
}

module.exports = RegistryDaemon;
