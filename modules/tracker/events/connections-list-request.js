/**
 * Connections List Request event
 * @module tracker/events/tree
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
     * @param {UserRepository} userRepo                 User repository
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, userRepo, daemonRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._connectionRepo = connectionRepo;
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
        return [ 'app', 'config', 'repositories.user', 'repositories.daemon', 'repositories.connection' ];
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
        return this._daemonRepo.findByToken(message.connectionsListRequest.token)
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

                let list = this.tracker.ConnectionsList.create({
                    serverConnections: [],
                    clientConnections: [],
                });

                let getFullName = peer => {
                    return this._userRepo.find(peer.userId)
                        .then(owners => {
                            let owner = owners.length && owners[0];
                            if (!owner)
                                return;

                            return owner.email + '/' + peer.name;
                        });
                };

                return this._connectionRepo.findByDaemon(daemon)
                    .then(connections => {
                        let promises = [];
                        for (let connection of connections) {
                            if (connection.actingAs == 'server') {
                                if (!connection.fixed) {
                                    list.serverConnections.push(this.tracker.ServerConnection.create({
                                        id: connection.id,
                                        connectAddress: connection.connectAddress,
                                        connectPort: connection.connectPort,
                                        encrypted: connection.encrypted,
                                        fixed: connection.fixed,
                                        clients: [],
                                    }));
                                    continue;
                                }

                                let clients = [];
                                promises.push(
                                    this._daemonRepo.findByConnection(connection)
                                        .then(peers => {
                                            let peerPromises = [];
                                            for (let peer of peers) {
                                                if (peer.actingAs != 'client')
                                                    continue;
                                                peerPromises.push(
                                                    getFullName(peer)
                                                        .then(name => {
                                                            if (!name)
                                                                return;

                                                            clients.push(name);
                                                        })
                                                );
                                            }

                                            if (peerPromises.length)
                                                return Promise.all(peerPromises);
                                        })
                                        .then(() => {
                                            list.serverConnections.push(this.tracker.ServerConnection.create({
                                                id: connection.id,
                                                connectAddress: connection.connectAddress,
                                                connectPort: connection.connectPort,
                                                encrypted: connection.encrypted,
                                                fixed: connection.fixed,
                                                clients: clients,
                                            }));
                                        })
                                );
                            } else if (connection.actingAs == 'client') {
                                promises.push(
                                    this._daemonRepo.findServerByConnection(connection)
                                        .then(servers => {
                                            let server = servers.length && servers[0];
                                            if (!server)
                                                return;

                                            return getFullName(server)
                                                .then(name => {
                                                    if (!name)
                                                        return;

                                                    list.clientConnections.push(this.tracker.ClientConnection.create({
                                                        id: connection.id,
                                                        listenAddress: connection.listenAddress,
                                                        listenPort: connection.listenPort,
                                                        encrypted: connection.encrypted,
                                                        server: name,
                                                    }));
                                                });
                                        })
                                );
                            }
                        }
                        if (promises.length)
                            return Promise.all(promises);
                    })
                    .then(() => {
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
                    });
            })
            .catch(error => {
                this._tracker._logger.error(new WError(error, 'ConnectionsListRequest.handle()'));
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