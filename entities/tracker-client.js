/**
 * Tracker Client Entity
 * @module entities/tracker-client
 */

/**
 * Tracker Client Entity
 */
class TrackerClient {
    /**
     * Create entity
     * @param {string} id
     */
    constructor(id) {
        this._id = id;
        this._socket = null;
        this._wrapper = null;
    }

    /**
     * Service name is 'entities.trackerClient'
     * @type {string}
     */
    static get provides() {
        return 'entities.trackerClient';
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
     * Socket setter
     * @param {object} socket
     */
    set socket(socket) {
        this._socket = socket;
    }

    /**
     * Socket getter
     * @type {object}
     */
    get socket() {
        return this._socket;
    }

    /**
     * Socket Wrapper setter
     * @param {object} wrapper
     */
    set wrapper(wrapper) {
        this._wrapper = wrapper;
    }

    /**
     * Socket Wrapper getter
     * @type {object}
     */
    get wrapper() {
        return this._wrapper;
    }
}

module.exports = TrackerClient;
