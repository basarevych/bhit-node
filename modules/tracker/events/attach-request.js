/**
 * Attach Request event
 * @module tracker/events/attach-request
 */
const moment = require('moment-timezone');
const NError = require('nerror');

/**
 * Attach Request event class
 */
class AttachRequest {
    /**
     * Create service
     * @param {App} app                                         The application
     * @param {object} config                                   Configuration
     * @param {Logger} logger                                   Logger service
     * @param {Registry} registry                               Registry service
     * @param {RegisterDaemonRequest} registerDaemonRequest     RegisterDaemonRequest event
     * @param {DetachRequest} detachRequest                     DetachRequest event
     * @param {UserRepository} userRepo                         User repository
     * @param {DaemonRepository} daemonRepo                     Daemon repository
     * @param {PathRepository} pathRepo                         Path repository
     * @param {ConnectionRepository} connectionRepo             Connection repository
     */
    constructor(app, config, logger, registry, registerDaemonRequest, detachRequest, userRepo, daemonRepo, pathRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._registerDaemonRequest = registerDaemonRequest;
        this._detachRequest = detachRequest;
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
            'registry',
            'modules.tracker.events.registerDaemonRequest',
            'modules.tracker.events.detachRequest',
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
        let client = this._registry.clients.get(id);
        if (!client)
            return;

        let userEmail, userPath, target = this._registry.validatePath(message.attachRequest.path);
        if (target) {
            userEmail = target.email;
            userPath = target.path;
        }

        this._logger.debug('attach-request', `Got ATTACH REQUEST from ${id}`);
        return Promise.resolve()
            .then(() => {
                if (!client.daemonId)
                    return [];

                let info = this._registry.daemons.get(client.daemonId);
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
                    this._logger.debug('attach-request', `Sending REJECTED ATTACH RESPONSE to ${id}`);
                    return this.tracker.send(id, data);
                }
                if (!target) {
                    let response = this.tracker.AttachResponse.create({
                        response: this.tracker.AttachResponse.Result.INVALID_PATH,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.ATTACH_RESPONSE,
                        messageId: message.messageId,
                        attachResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('attach-request', `Sending INVALID_PATH ATTACH RESPONSE to ${id}`);
                    return this.tracker.send(id, data);
                }

                let userId;
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

                        if (!actingAs || user.id !== userId) {
                            let response = this.tracker.AttachResponse.create({
                                response: this.tracker.AttachResponse.Result.PATH_NOT_FOUND,
                            });
                            let reply = this.tracker.ServerMessage.create({
                                type: this.tracker.ServerMessage.Type.ATTACH_RESPONSE,
                                messageId: message.messageId,
                                attachResponse: response,
                            });
                            let data = this.tracker.ServerMessage.encode(reply).finish();
                            this._logger.debug('attach-request', `Sending PATH_NOT_FOUND ATTACH RESPONSE to ${id}`);
                            return this.tracker.send(id, data);
                        }

                        let loadConnection = (path, fullPath) => {
                            return this._connectionRepo.findByPath(path)
                                .then(connections => {
                                    let connection = connections.length && connections[0];
                                    if (connection && path.path === fullPath)
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
                                        });
                                });
                        };

                        return Promise.resolve()
                            .then(() => {
                                if (actingAs === 'server') {
                                    if (message.attachRequest.addressOverride === '*')
                                        message.attachRequest.addressOverride = '';
                                    if (message.attachRequest.portOverride === '*')
                                        message.attachRequest.portOverride = '';

                                    return this._pathRepo.find(connection.pathId)
                                        .then(paths => {
                                            let path = paths.length && paths[0];
                                            if (path && path.path === userPath)
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
                                    this._logger.debug('attach-request', `Sending PATH_NOT_FOUND ATTACH RESPONSE to ${id}`);
                                    return this.tracker.send(id, data);
                                }

                                let connection = result[0];
                                let path = result[1];

                                return this._detachRequest.disconnect(daemon, connection)
                                    .then(count => {
                                        if (!count)
                                            return;

                                        let info = this._registry.daemons.get(daemon.id);
                                        if (info) {
                                            let promises = [];
                                            for (let notifyId of info.clients)
                                                promises.push(this._registerDaemonRequest.sendConnectionsList(notifyId));

                                            if (promises.length)
                                                return Promise.all(promises);
                                        }
                                    })
                                    .then(() => {
                                        if (actingAs !== 'server')
                                            return;

                                        return this._daemonRepo.findServerByConnection(connection)
                                            .then(oldDaemons => {
                                                let oldDaemon = oldDaemons.length && oldDaemons[0];
                                                if (!oldDaemon)
                                                    return;

                                                return this._detachRequest.disconnect(oldDaemon, connection)
                                                    .then(count => {
                                                        if (!count)
                                                            return;

                                                        let info = this._registry.daemons.get(oldDaemon.id);
                                                        if (info) {
                                                            let promises = [];
                                                            for (let notifyId of info.clients)
                                                                promises.push(this._registerDaemonRequest.sendConnectionsList(notifyId));

                                                            if (promises.length)
                                                                return Promise.all(promises);
                                                        }
                                                    });
                                            });
                                    })
                                    .then(() => {
                                        return this._daemonRepo.connect(
                                            daemon,
                                            connection,
                                            actingAs,
                                            message.attachRequest.addressOverride,
                                            message.attachRequest.portOverride
                                        );
                                    })
                                    .then(count => {
                                        let serverConnections = [], clientConnections = [];

                                        return Promise.resolve()
                                            .then(() => {
                                                if (count === 0)
                                                    return this.tracker.AttachResponse.Result.ALREADY_CONNECTED;

                                                if (actingAs === 'server') {
                                                    return this._daemonRepo.findByConnection(connection)
                                                        .then(clientDaemons => {
                                                            let clients = [];
                                                            let clientPromises = [];
                                                            for (let clientDaemon of clientDaemons) {
                                                                if (clientDaemon.actingAs !== 'client')
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
                                                                        connectAddress: message.attachRequest.addressOverride || connection.connectAddress || '',
                                                                        connectPort: message.attachRequest.portOverride || connection.connectPort || '',
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
                                                                        listenAddress: message.attachRequest.addressOverride || connection.listenAddress || '',
                                                                        listenPort: message.attachRequest.portOverride || connection.listenPort || '',
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
                                                this._logger.debug('attach-request', `Sending SUCCESS ATTACH RESPONSE to ${id}`);
                                                this.tracker.send(id, data);
                                            });
                                    });
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new NError(error, 'AttachRequest.handle()'));
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