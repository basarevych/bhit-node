/**
 * Address Response event
 * @module tracker/events/address-response
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Address Response event class
 */
class AddressResponse {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     */
    constructor(app, config, logger) {
        this._app = app;
        this._config = config;
        this._logger = logger;
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
        return [ 'app', 'config', 'logger' ];
    }

    /**
     * Event handler
     * @param {object} info         Info as in dgram
     * @param {object} message      The message
     */
    handle(info, message) {
        let pair = this.tracker.pairs.get(message.addressResponse.requestId);
        if (!pair)
            return;

        debug(`Got ADDRESS RESPONSE from ${info.address}:${info.port}`);
        if (pair.clientRequestId == message.addressResponse.requestId) {
            pair.clientAddress = info.address;
            pair.clientPort = info.port.toString();
        } else if (pair.serverRequestId == message.addressResponse.requestId) {
            pair.serverAddress = info.address;
            pair.serverPort = info.port.toString();
        }

        if (!pair.clientPort || !pair.serverPort)
            return;

        this.tracker.pairs.delete(pair.clientRequestId);
        this.tracker.pairs.delete(pair.serverRequestId);

        let server = this.tracker.clients.get(pair.serverId);
        let client = this.tracker.clients.get(pair.clientId);
        if (!server || !client)
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
            debug(`Sending PEER AVAILABLE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
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
            debug(`Sending PEER AVAILABLE to ${server.socket.remoteAddress}:${server.socket.remotePort}`);
            return this.tracker.send(pair.serverId, data);
        } catch (error) {
            this._logger.error(new WError(error, 'AddressResponse.handle()'));
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