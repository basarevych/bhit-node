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
        if (this._config.get(`servers.${name}.class`) !== 'servers.tracker')
            return Promise.resolve();

        let server = this._app.get('servers').get('tracker');

        let initRequest = this._app.get('modules.tracker.events.initRequest');
        server.on('init_request', initRequest.handle.bind(initRequest));

        let confirmRequest = this._app.get('modules.tracker.events.confirmRequest');
        server.on('confirm_request', confirmRequest.handle.bind(confirmRequest));

        let createDaemonRequest = this._app.get('modules.tracker.events.createDaemonRequest');
        server.on('create_daemon_request', createDaemonRequest.handle.bind(createDaemonRequest));

        let registerDaemonRequest = this._app.get('modules.tracker.events.registerDaemonRequest');
        server.on('register_daemon_request', registerDaemonRequest.handle.bind(registerDaemonRequest));

        let createRequest = this._app.get('modules.tracker.events.createRequest');
        server.on('create_request', createRequest.handle.bind(createRequest));

        let deleteRequest = this._app.get('modules.tracker.events.deleteRequest');
        server.on('delete_request', deleteRequest.handle.bind(deleteRequest));

        let importRequest = this._app.get('modules.tracker.events.importRequest');
        server.on('import_request', importRequest.handle.bind(importRequest));

        let attachRequest = this._app.get('modules.tracker.events.attachRequest');
        server.on('attach_request', attachRequest.handle.bind(attachRequest));

        let detachRequest = this._app.get('modules.tracker.events.detachRequest');
        server.on('detach_request', detachRequest.handle.bind(detachRequest));

        let treeRequest = this._app.get('modules.tracker.events.treeRequest');
        server.on('tree_request', treeRequest.handle.bind(treeRequest));

        let connectionsListRequest = this._app.get('modules.tracker.events.connectionsListRequest');
        server.on('connections_list_request', connectionsListRequest.handle.bind(connectionsListRequest));

        let status = this._app.get('modules.tracker.events.status');
        server.on('status', status.handle.bind(status));

        let lookupIdentityRequest = this._app.get('modules.tracker.events.lookupIdentityRequest');
        server.on('lookup_identity_request', lookupIdentityRequest.handle.bind(lookupIdentityRequest));

        let punchRequest = this._app.get('modules.tracker.events.punchRequest');
        server.on('punch_request', punchRequest.handle.bind(punchRequest));

        let addressResponse = this._app.get('modules.tracker.events.addressResponse');
        server.on('address_response', addressResponse.handle.bind(addressResponse));

        let redeemMasterRequest = this._app.get('modules.tracker.events.redeemMasterRequest');
        server.on('redeem_master_request', redeemMasterRequest.handle.bind(redeemMasterRequest));

        let redeemDaemonRequest = this._app.get('modules.tracker.events.redeemDaemonRequest');
        server.on('redeem_daemon_request', redeemDaemonRequest.handle.bind(redeemDaemonRequest));

        let redeemPathRequest = this._app.get('modules.tracker.events.redeemPathRequest');
        server.on('redeem_path_request', redeemPathRequest.handle.bind(redeemPathRequest));

        return Promise.resolve();
    }
}

module.exports = Tracker;
