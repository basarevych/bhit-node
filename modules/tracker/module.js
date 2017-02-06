/**
 * Index module
 * @module tracker/module
 */


/**
 * Module main class
 */
class Index {
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
     * Register message handlers
     * @return {Promise}
     */
    messages() {
        let server = this._app.get('servers.tracker');

        let initRequest = this._app.get('modules.tracker.messages.initRequest');
        server.on('init_request', initRequest.onMessage.bind(initRequest));

        let initConfirm = this._app.get('modules.tracker.messages.initConfirm');
        server.on('init_confirm', initConfirm.onMessage.bind(initConfirm));

        return Promise.resolve();
    }
}

module.exports = Index;
