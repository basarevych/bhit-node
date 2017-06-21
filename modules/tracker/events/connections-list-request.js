/**
 * Connections List Request event
 * @module tracker/events/connections-list-request
 */
const moment = require('moment-timezone');
const NError = require('nerror');

/**
 * Connections List Request event class
 */
class ConnectionsListRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {Registry} registry                       Registry service
     * @param {DaemonRepository} daemonRepo             Daemon repository
     */
    constructor(app, config, logger, registry, daemonRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._daemonRepo = daemonRepo;
    }

    /**
     * Service name is 'modules.tracker.events.connectionsListRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.connectionsListRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'registry', 'repositories.daemon' ];
    }

    /**
     * Event handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    handle(id, message) {
        let client = this._registry.clients.get(id);
        if (!client)
            return;

        this._logger.debug('connections-list-request', `Got CONNECTIONS LIST REQUEST from ${id}`);
        return Promise.resolve()
            .then(() => {
                if (!client.daemonId)
                    return [];

                return this._daemonRepo.find(client.daemonId);
            })
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon) {
                    let response = this.tracker.ConnectionsListResponse.create({
                        response: this.tracker.ConnectionsListResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.CONNECTIONS_LIST_RESPONSE,
                        messageId: message.messageId,
                        connectionsListResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('connections-list-request', `Sending REJECTED CONNECTIONS LIST RESPONSE to ${id}`);
                    return this.tracker.send(id, data);
                }

                return this._daemonRepo.getConnectionsList(daemon)
                    .then(list => {
                        if (!list) {
                            let response = this.tracker.ConnectionsListResponse.create({
                                response: this.tracker.ConnectionsListResponse.Result.REJECTED,
                            });
                            let reply = this.tracker.ServerMessage.create({
                                type: this.tracker.ServerMessage.Type.CONNECTIONS_LIST_RESPONSE,
                                messageId: message.messageId,
                                connectionsListResponse: response,
                            });
                            let data = this.tracker.ServerMessage.encode(reply).finish();
                            this._logger.debug('connections-list-request', `Sending REJECTED CONNECTIONS LIST RESPONSE to ${id}`);
                            return this.tracker.send(id, data);
                        }

                        let prepared = this.tracker.ConnectionsList.create({
                            serverConnections: [],
                            clientConnections: [],
                        });
                        for (let item of list.serverConnections)
                            prepared.serverConnections.push(this.tracker.ServerConnection.create(item));
                        for (let item of list.clientConnections)
                            prepared.clientConnections.push(this.tracker.ClientConnection.create(item));

                        let response = this.tracker.ConnectionsListResponse.create({
                            response: this.tracker.ConnectionsListResponse.Result.ACCEPTED,
                            list: prepared,
                        });
                        let reply = this.tracker.ServerMessage.create({
                            type: this.tracker.ServerMessage.Type.CONNECTIONS_LIST_RESPONSE,
                            messageId: message.messageId,
                            connectionsListResponse: response,
                        });
                        let data = this.tracker.ServerMessage.encode(reply).finish();
                        this._logger.debug('connections-list-request', `Sending ACCEPTED CONNECTIONS LIST RESPONSE to ${id}`);
                        this.tracker.send(id, data);
                    })
            })
            .catch(error => {
                this._logger.error(new NError(error, 'ConnectionsListRequest.handle()'));
            });
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

module.exports = ConnectionsListRequest;