/**
 * Tracker module
 * @module tracker/module
 */


/**
 * Module main class
 */
class Tracker {
    /**
     * Create the module
     * @param {App} app             The application
     * @param {object} config       Configuration
     */
    constructor(app, config) {
        this._app = app;
        this._config = config;
    }

    /**
     * Service name is 'modules.tracker'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config' ];
    }

    /**
     * Bootstrap the module
     * @return {Promise}
     */
    bootstrap() {
        return Promise.resolve();
    }

    /**
     * Register with the server
     * @param {string} name                     Server name as in config
     * @return {Promise}
     */
    register(name) {
        if (this._config.get(`servers.${name}.class`) != 'servers.tracker')
            return Promise.resolve();

        let server = this._app.get('servers').get('tracker');

        let initRequest = this._app.get('modules.tracker.messages.initRequest');
        server.on('init_request', initRequest.onMessage.bind(initRequest));

        let confirmRequest = this._app.get('modules.tracker.messages.confirmRequest');
        server.on('confirm_request', confirmRequest.onMessage.bind(confirmRequest));

        let createRequest = this._app.get('modules.tracker.messages.createRequest');
        server.on('create_request', createRequest.onMessage.bind(createRequest));

        let deleteRequest = this._app.get('modules.tracker.messages.deleteRequest');
        server.on('delete_request', createRequest.onMessage.bind(deleteRequest));

        return Promise.resolve();
    }
}

module.exports = Tracker;
