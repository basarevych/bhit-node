/**
 * Base event class
 * @module tracker/events/base
 */

/**
 * Base event class
 */
class BaseEvent {
    /**
     * Create service
     * @param {App} app                                 The application
     */
    constructor(app) {
        this._app = app;
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app' ];
    }

    /**
     * Retrieve server
     * @return {Tracker}
     */
    get tracker() {
        if (this._tracker)
            return this._tracker;
        this._tracker = this._app.get('servers').get('tracker');
        return this._tracker;
    }
}

module.exports = BaseEvent;
