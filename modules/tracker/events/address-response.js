/**
 * Address Response event
 * @module tracker/events/address-response
 */
const NError = require('nerror');

/**
 * Address Response event class
 */
class AddressResponse {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {Registry} registry                       Registry service
     */
    constructor(app, config, logger, registry) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
    }

    /**
     * Service name is 'modules.tracker.events.addressResponse'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.addressResponse';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'registry' ];
    }

    /**
     * Event handler
     * @param {object} info         rinfo as in dgram
     * @param {object} message      The message
     */
    handle(info, message) {
        this._logger.debug('address-response', `Got ADDRESS RESPONSE from ${info.address}:${info.port}`);

        let pair = this._registry.updatePair(message.addressResponse.requestId, info.address, info.port.toString());
        if (!pair)
            return;

        if (!this._registry.clients.has(pair.serverId) || !this._registry.clients.has(pair.clientId))
            return;

        try {
            let peer = this.tracker.PeerAvailable.create({
                connectionName: pair.connectionName,
                externalAddress: pair.serverAddress,
                externalPort: pair.serverPort,
            });
            let msg = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.PEER_AVAILABLE,
                peerAvailable: peer,
            });
            let data = this.tracker.ServerMessage.encode(msg).finish();
            this._logger.debug('address-response', `Sending PEER AVAILABLE to ${pair.clientId}`);
            this.tracker.send(pair.clientId, data);

            peer = this.tracker.PeerAvailable.create({
                connectionName: pair.connectionName,
                externalAddress: pair.clientAddress,
                externalPort: pair.clientPort,
            });
            msg = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.PEER_AVAILABLE,
                peerAvailable: peer,
            });
            data = this.tracker.ServerMessage.encode(msg).finish();
            this._logger.debug('address-response', `Sending PEER AVAILABLE to ${pair.serverId}`);
            return this.tracker.send(pair.serverId, data);
        } catch (error) {
            this._logger.error(new NError(error, 'AddressResponse.handle()'));
        }
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

module.exports = AddressResponse;