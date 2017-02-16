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

        let initRequest = this._app.get('modules.tracker.events.initRequest');
        server.on('init_request', initRequest.handle.bind(initRequest));

        let confirmRequest = this._app.get('modules.tracker.events.confirmRequest');
        server.on('confirm_request', confirmRequest.handle.bind(confirmRequest));

        let registerDaemonRequest = this._app.get('modules.tracker.events.registerDaemonRequest');
        server.on('register_daemon_request', registerDaemonRequest.handle.bind(registerDaemonRequest));

        let createRequest = this._app.get('modules.tracker.events.createRequest');
        server.on('create_request', createRequest.handle.bind(createRequest));

        let deleteRequest = this._app.get('modules.tracker.events.deleteRequest');
        server.on('delete_request', deleteRequest.handle.bind(deleteRequest));

        let connectRequest = this._app.get('modules.tracker.events.connectRequest');
        server.on('connect_request', connectRequest.handle.bind(connectRequest));

        let disconnectRequest = this._app.get('modules.tracker.events.disconnectRequest');
        server.on('disconnect_request', disconnectRequest.handle.bind(disconnectRequest));

        let treeRequest = this._app.get('modules.tracker.events.treeRequest');
        server.on('tree_request', treeRequest.handle.bind(treeRequest));

        let connectionsListRequest = this._app.get('modules.tracker.events.connectionsListRequest');
        server.on('connections_list_request', connectionsListRequest.handle.bind(connectionsListRequest));

        let status = this._app.get('modules.tracker.events.status');
        server.on('status', status.handle.bind(status));

        return Promise.resolve();
    }
}

module.exports = Tracker;
