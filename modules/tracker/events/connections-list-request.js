/**
 * Connections List Request event
 * @module tracker/events/connections-list-request
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Connections List Request event class
 */
class ConnectionsListRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {ConnectionsList} connectionsList         ConnectionsList service
     */
    constructor(app, config, daemonRepo, connectionsList) {
        this._app = app;
        this._config = config;
        this._daemonRepo = daemonRepo;
        this._connectionsList = connectionsList;
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
        return [ 'app', 'config', 'repositories.daemon', 'modules.tracker.connectionsList' ];
    }

    /**
     * Event handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    handle(id, message) {
        let client = this.tracker.clients.get(id);
        if (!client)
            return;

        debug(`Got CONNECTIONS LIST REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
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
                    debug(`Sending CONNECTIONS LIST RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                return this._connectionsList.getList(daemon.id)
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
                            debug(`Sending CONNECTIONS LIST RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                            return this.tracker.send(id, data);
                        }

                        let response = this.tracker.ConnectionsListResponse.create({
                            response: this.tracker.ConnectionsListResponse.Result.ACCEPTED,
                            list: list,
                        });
                        let reply = this.tracker.ServerMessage.create({
                            type: this.tracker.ServerMessage.Type.CONNECTIONS_LIST_RESPONSE,
                            messageId: message.messageId,
                            connectionsListResponse: response,
                        });
                        let data = this.tracker.ServerMessage.encode(reply).finish();
                        debug(`Sending CONNECTIONS LIST RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                        this.tracker.send(id, data);
                    })
            })
            .catch(error => {
                this.tracker._logger.error(new WError(error, 'ConnectionsListRequest.handle()'));
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