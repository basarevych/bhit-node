/**
 * Attach Request event
 * @module tracker/events/attach-request
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Attach Request event class
 */
class AttachRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {UserRepository} userRepo                 User repository
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {PathRepository} pathRepo                 Path repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, logger, userRepo, daemonRepo, pathRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'modules.tracker.events.attachRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.attachRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [
            'app',
            'config',
            'logger',
            'repositories.user',
            'repositories.daemon',
            'repositories.path',
            'repositories.connection'
        ];
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

        let userId, userEmail, userPath;
        let parts = message.attachRequest.path.split('/');
        if (parts.length && parts[0].length) {
            userEmail = parts.shift();
            parts.unshift('');
        }
        userPath = parts.join('/');

        debug(`Got ATTACH REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        return Promise.resolve()
            .then(() => {
                if (!client.daemonId)
                    return [];

                let info = this.tracker.daemons.get(client.daemonId);
                if (!info)
                    return [];

                if (!userEmail)
                    userEmail = info.userEmail;

                return this._daemonRepo.find(client.daemonId);
            })
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon) {
                    let response = this.tracker.AttachResponse.create({
                        response: this.tracker.AttachResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.ATTACH_RESPONSE,
                        messageId: message.messageId,
                        attachResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    debug(`Sending ATTACH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }
                if (!this.tracker.validatePath(userPath)) {
                    let response = this.tracker.AttachResponse.create({
                        response: this.tracker.AttachResponse.Result.INVALID_PATH,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.ATTACH_RESPONSE,
                        messageId: message.messageId,
                        attachResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    debug(`Sending ATTACH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                return Promise.all([
                        this._pathRepo.findByToken(message.attachRequest.token),
                        this._connectionRepo.findByToken(message.attachRequest.token),
                        this._userRepo.findByEmail(userEmail),
                    ])
                    .then(([ paths, connections, users ]) => {
                        let path = paths.length && paths[0];
                        let connection = connections.length && connections[0];
                        let user = users.length && users[0];

                        let actingAs;
                        if (user) {
                            if (path) {
                                actingAs = 'client';
                                userId = path.userId;
                            } else if (connection) {
                                actingAs = 'server';
                                userId = connection.userId;
                            }
                        }

                        if (!actingAs || user.id != userId) {
                            let response = this.tracker.AttachResponse.create({
                                response: this.tracker.AttachResponse.Result.PATH_NOT_FOUND,
                            });
                            let reply = this.tracker.ServerMessage.create({
                                type: this.tracker.ServerMessage.Type.ATTACH_RESPONSE,
                                messageId: message.messageId,
                                attachResponse: response,
                            });
                            let data = this.tracker.ServerMessage.encode(reply).finish();
                            debug(`Sending ATTACH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                            return this.tracker.send(id, data);
                        }

                        let loadConnection = (path, fullPath) => {
                            return this._connectionRepo.findByPath(path)
                                .then(connections => {
                                    let connection = connections.length && connections[0];
                                    if (connection && path.path == fullPath)
                                        return [ connection, path ];

                                    return this._pathRepo.findByParent(path)
                                        .then(paths => {
                                            let promises = [];
                                            for (let subPath of paths)
                                                promises.push(loadConnection(subPath, fullPath));

                                            return Promise.all(promises)
                                                .then(loaded => {
                                                    for (let subResult of loaded) {
                                                        if (subResult)
                                                            return subResult;
                                                    }

                                                    return null;
                                                });
                                        })
                                });
                        };

                        return Promise.resolve()
                            .then(() => {
                                if (actingAs == 'server') {
                                    return this._pathRepo.find(connection.pathId)
                                        .then(paths => {
                                            let path = paths.length && paths[0];
                                            if (path && path.path == userPath)
                                                return [ connection, path ];

                                            return null;
                                        });
                                }

                                return loadConnection(path, userPath);
                            })
                            .then(result => {
                                if (!result) {
                                    let response = this.tracker.AttachResponse.create({
                                        response: this.tracker.AttachResponse.Result.PATH_NOT_FOUND,
                                    });
                                    let reply = this.tracker.ServerMessage.create({
                                        type: this.tracker.ServerMessage.Type.ATTACH_RESPONSE,
                                        messageId: message.messageId,
                                        attachResponse: response,
                                    });
                                    let data = this.tracker.ServerMessage.encode(reply).finish();
                                    debug(`Sending ATTACH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                    return this.tracker.send(id, data);
                                }

                                let connection = result && result[0];
                                let path = result && result[1];

                                return this._daemonRepo.connect(daemon, connection, actingAs)
                                    .then(count => {
                                        let serverConnections = [], clientConnections = [];

                                        return Promise.resolve()
                                            .then(() => {
                                                if (count === 0)
                                                    return this.tracker.AttachResponse.Result.ALREADY_CONNECTED;

                                                if (actingAs == 'server') {
                                                    return this._daemonRepo.findByConnection(connection)
                                                        .then(clientDaemons => {
                                                            let clients = [];
                                                            let clientPromises = [];
                                                            for (let clientDaemon of clientDaemons) {
                                                                if (clientDaemon.actingAs != 'client')
                                                                    continue;

                                                                clientPromises.push(
                                                                    this._userRepo.find(clientDaemon.userId)
                                                                        .then(clientUsers => {
                                                                            let clientUser = clientUsers.length && clientUsers[0];
                                                                            if (!clientUser)
                                                                                return;

                                                                            clients.push(clientUser.email + '?' + clientDaemon.name);
                                                                        })
                                                                );
                                                            }

                                                            return Promise.all(clientPromises)
                                                                .then(() => {
                                                                    serverConnections.push(this.tracker.ServerConnection.create({
                                                                        name: userEmail + path.path,
                                                                        connectAddress: connection.connectAddress,
                                                                        connectPort: connection.connectPort,
                                                                        encrypted: connection.encrypted,
                                                                        fixed: connection.fixed,
                                                                        clients: clients,
                                                                    }));

                                                                    return this.tracker.AttachResponse.Result.ACCEPTED;
                                                                });
                                                        });
                                                } else {
                                                    return this._daemonRepo.findServerByConnection(connection)
                                                        .then(serverDaemons => {
                                                            let serverDaemon = serverDaemons.length && serverDaemons[0];

                                                            return Promise.resolve()
                                                                .then(() => {
                                                                    if (!serverDaemon)
                                                                        return [];

                                                                    return this._userRepo.find(serverDaemon.userId);
                                                                })
                                                                .then(serverUsers => {
                                                                    let serverUser = serverUsers.length && serverUsers[0];

                                                                    clientConnections.push(this.tracker.ClientConnection.create({
                                                                        name: userEmail + path.path,
                                                                        listenAddress: connection.listenAddress,
                                                                        listenPort: connection.listenPort,
                                                                        encrypted: connection.encrypted,
                                                                        fixed: connection.fixed,
                                                                        server: (serverDaemon && serverUser) ? serverUser.email + '?' + serverDaemon.name : '',
                                                                    }));

                                                                    return this.tracker.AttachResponse.Result.ACCEPTED;
                                                                });
                                                        });
                                                }
                                            })
                                            .then(value => {
                                                let list = this.tracker.ConnectionsList.create({
                                                    serverConnections: serverConnections,
                                                    clientConnections: clientConnections,
                                                });
                                                let response = this.tracker.AttachResponse.create({
                                                    response: value,
                                                    updates: list,
                                                });
                                                let reply = this.tracker.ServerMessage.create({
                                                    type: this.tracker.ServerMessage.Type.ATTACH_RESPONSE,
                                                    messageId: message.messageId,
                                                    attachResponse: response,
                                                });
                                                let data = this.tracker.ServerMessage.encode(reply).finish();
                                                debug(`Sending ATTACH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                                this.tracker.send(id, data);
                                            });
                                    });
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'AttachRequest.handle()'));
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

module.exports = AttachRequest;