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
     * @param {App} app                             The application
     * @param {object} config                       Configuration
     * @param {InvalidateCache} invalidateCache     InvalidateCache service
     * @param {InitRequest} initRequest
     * @param {ConfirmRequest} confirmRequest
     * @param {CreateDaemonRequest} createDaemonRequest
     * @param {RegisterDaemonRequest} registerDaemonRequest
     * @param {CreateRequest} createRequest
     * @param {DeleteRequest} deleteRequest
     * @param {ImportRequest} importRequest
     * @param {AttachRequest} attachRequest
     * @param {DetachRequest} detachRequest
     * @param {TreeRequest} treeRequest
     * @param {ConnectionsListRequest} connectionsListRequest
     * @param {DaemonsListRequest} daemonsListRequest
     * @param {Status} status
     * @param {LookupIdentityRequest} lookupIdentityRequest
     * @param {PunchRequest} punchRequest
     * @param {AddressResponse} addressResponse
     * @param {RedeemMasterRequest} redeemMasterRequest
     * @param {RedeemDaemonRequest} redeemDaemonRequest
     * @param {RedeemPathRequest} redeemPathRequest
     */
    constructor(app, config, invalidateCache, initRequest, confirmRequest, createDaemonRequest, registerDaemonRequest,
        createRequest, deleteRequest, importRequest, attachRequest, detachRequest, treeRequest, connectionsListRequest, daemonsListRequest,
        status, lookupIdentityRequest, punchRequest, addressResponse, redeemMasterRequest, redeemDaemonRequest, redeemPathRequest)
    {
        this._app = app;
        this._config = config;
        this._invalidateCache = invalidateCache;
        this._initRequest = initRequest;
        this._confirmRequest = confirmRequest;
        this._createDaemonRequest = createDaemonRequest;
        this._registerDaemonRequest = registerDaemonRequest;
        this._createRequest = createRequest;
        this._deleteRequest = deleteRequest;
        this._importRequest = importRequest;
        this._attachRequest = attachRequest;
        this._detachRequest = detachRequest;
        this._treeRequest = treeRequest;
        this._connectionsListRequest = connectionsListRequest;
        this._daemonsListRequest = daemonsListRequest;
        this._status = status;
        this._lookupIdentityRequest = lookupIdentityRequest;
        this._punchRequest = punchRequest;
        this._addressResponse = addressResponse;
        this._redeemMasterRequest = redeemMasterRequest;
        this._redeemDaemonRequest = redeemDaemonRequest;
        this._redeemPathRequest = redeemPathRequest;
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
        return [
            'app',
            'config',
            'invalidateCache',
            'modules.tracker.events.initRequest',
            'modules.tracker.events.confirmRequest',
            'modules.tracker.events.createDaemonRequest',
            'modules.tracker.events.registerDaemonRequest',
            'modules.tracker.events.createRequest',
            'modules.tracker.events.deleteRequest',
            'modules.tracker.events.importRequest',
            'modules.tracker.events.attachRequest',
            'modules.tracker.events.detachRequest',
            'modules.tracker.events.treeRequest',
            'modules.tracker.events.connectionsListRequest',
            'modules.tracker.events.daemonsListRequest',
            'modules.tracker.events.status',
            'modules.tracker.events.lookupIdentityRequest',
            'modules.tracker.events.punchRequest',
            'modules.tracker.events.addressResponse',
            'modules.tracker.events.redeemMasterRequest',
            'modules.tracker.events.redeemDaemonRequest',
            'modules.tracker.events.redeemPathRequest',
        ];
    }

    /**
     * Bootstrap the module
     * @return {Promise}
     */
    bootstrap() {
        return this._invalidateCache.register();
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
        server.on('init_request', this._initRequest.handle.bind(this._initRequest));
        server.on('confirm_request', this._confirmRequest.handle.bind(this._confirmRequest));
        server.on('create_daemon_request', this._createDaemonRequest.handle.bind(this._createDaemonRequest));
        server.on('register_daemon_request', this._registerDaemonRequest.handle.bind(this._registerDaemonRequest));
        server.on('create_request', this._createRequest.handle.bind(this._createRequest));
        server.on('delete_request', this._deleteRequest.handle.bind(this._deleteRequest));
        server.on('import_request', this._importRequest.handle.bind(this._importRequest));
        server.on('attach_request', this._attachRequest.handle.bind(this._attachRequest));
        server.on('detach_request', this._detachRequest.handle.bind(this._detachRequest));
        server.on('tree_request', this._treeRequest.handle.bind(this._treeRequest));
        server.on('connections_list_request', this._connectionsListRequest.handle.bind(this._connectionsListRequest));
        server.on('daemons_list_request', this._daemonsListRequest.handle.bind(this._daemonsListRequest));
        server.on('status', this._status.handle.bind(this._status));
        server.on('lookup_identity_request', this._lookupIdentityRequest.handle.bind(this._lookupIdentityRequest));
        server.on('punch_request', this._punchRequest.handle.bind(this._punchRequest));
        server.on('address_response', this._addressResponse.handle.bind(this._addressResponse));
        server.on('redeem_master_request', this._redeemMasterRequest.handle.bind(this._redeemMasterRequest));
        server.on('redeem_daemon_request', this._redeemDaemonRequest.handle.bind(this._redeemDaemonRequest));
        server.on('redeem_path_request', this._redeemPathRequest.handle.bind(this._redeemPathRequest));

        return Promise.resolve();
    }
}

module.exports = Tracker;
