/**
 * Attach Request event
 * @module tracker/events/attach-request
 */
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
     * Service name is 'tracker.events.attachRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.attachRequest';
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
            'tracker.events.registerDaemonRequest',
            'tracker.events.detachRequest',
            'repositories.user',
            'repositories.daemon',
            'repositories.path',
            'repositories.connection'
        ];
    }

    /**
     * Event name
     * @type {string}
     */
    get name() {
        return 'attach_request';
    }

    /**
     * Event handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    async handle(id, message) {
        let client = this._registry.clients.get(id);
        if (!client)
            return;

        this._logger.debug('attach-request', `Got ATTACH REQUEST from ${id}`);
        try {
            let userEmail, userPath;
            let target = this._registry.validatePath(message.attachRequest.path);
            if (target) {
                userEmail = target.email;
                userPath = target.path;
            }

            let daemons = [];
            if (client.daemonId) {
                let info = this._registry.daemons.get(client.daemonId);
                if (info) {
                    if (!userEmail)
                        userEmail = info.userEmail;

                    daemons = await this._daemonRepo.find(client.daemonId);
                }
            }
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
            if (message.attachRequest.portOverride && message.attachRequest.portOverride[0] === '/' && message.attachRequest.addressOverride) {
                let response = this.tracker.AttachResponse.create({
                    response: this.tracker.AttachResponse.Result.INVALID_ADDRESS,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.ATTACH_RESPONSE,
                    messageId: message.messageId,
                    attachResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('attach-request', `Sending INVALID_ADDRESS ATTACH RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let [paths, connections, users] = await Promise.all([
                this._pathRepo.findByToken(message.attachRequest.token),            // we don't know
                this._connectionRepo.findByToken(message.attachRequest.token),      // which token it is
                this._userRepo.findByEmail(userEmail),
            ]);
            let path = paths.length && paths[0];
            let connection = connections.length && connections[0];
            let user = users.length && users[0];

            let actingAs, userId;
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
            if (actingAs === 'server' && (message.attachRequest.portOverride === '*' || message.attachRequest.addressOverride === '*')) {
                let response = this.tracker.AttachResponse.create({
                    response: this.tracker.AttachResponse.Result.INVALID_ADDRESS,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.ATTACH_RESPONSE,
                    messageId: message.messageId,
                    attachResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('attach-request', `Sending INVALID_ADDRESS ATTACH RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let loadConnection = async (path, fullPath) => {
                let connections = await this._connectionRepo.findByPath(path);
                let connection = connections.length && connections[0];
                if (connection && path.path === fullPath)
                    return [connection, path];

                let paths = await this._pathRepo.findByParent(path);
                let promises = [];
                for (let subPath of paths)
                    promises.push(loadConnection(subPath, fullPath));

                let loaded = await Promise.all(promises);
                for (let subResult of loaded) {
                    if (subResult)
                        return subResult;
                }

                return [null, null];
            };

            if (actingAs === 'server') {
                let paths = await this._pathRepo.find(connection.pathId);
                path = paths.length && paths[0];
                if (path.path !== userPath)
                    path = null;
            } else {
                let [thisConn, thisPath] = await loadConnection(path, userPath);
                connection = thisConn;
                path = thisPath;
            }

            if (!path) {
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

            let count = await this._detachRequest.disconnect(daemon, connection);
            if (count) {
                let info = this._registry.daemons.get(daemon.id);
                if (info) {
                    let promises = [];
                    for (let notifyId of info.clients)
                        promises.push(this._registerDaemonRequest.sendConnectionsList(notifyId));

                    if (promises.length)
                        await Promise.all(promises);
                }
            }

            if (actingAs === 'server') {
                let oldDaemons = await this._daemonRepo.findServerByConnection(connection);
                let oldDaemon = oldDaemons.length && oldDaemons[0];
                if (oldDaemon) {
                    count = await this._detachRequest.disconnect(oldDaemon, connection);
                    if (count) {
                        let info = this._registry.daemons.get(oldDaemon.id);
                        if (info) {
                            let promises = [];
                            for (let notifyId of info.clients)
                                promises.push(this._registerDaemonRequest.sendConnectionsList(notifyId));

                            if (promises.length)
                                await Promise.all(promises);
                        }
                    }
                }
            }

            let serverConnections = [];
            let clientConnections = [];
            let value;

            count = await this.connect(daemon, connection, actingAs, message.attachRequest.addressOverride, message.attachRequest.portOverride);
            if (count === 0) {
                value = this.tracker.AttachResponse.Result.ALREADY_ATTACHED;
            } else {
                if (actingAs === 'server') {
                    let clients = [];
                    for (let clientDaemon of await this._daemonRepo.findByConnection(connection)) {
                        if (clientDaemon.actingAs !== 'client')
                            continue;

                        let clientUsers = await this._userRepo.find(clientDaemon.userId);
                        let clientUser = clientUsers.length && clientUsers[0];
                        if (clientUser)
                            clients.push(clientUser.email + '?' + clientDaemon.name);
                    }

                    let {address, port} = this._registry.addressOverride(
                        connection.connectAddress,
                        connection.connectPort,
                        message.attachRequest.addressOverride,
                        message.attachRequest.portOverride
                    );

                    serverConnections.push(this.tracker.ServerConnection.create({
                        name: userEmail + path.path,
                        connectAddress: address,
                        connectPort: port,
                        encrypted: connection.encrypted,
                        fixed: connection.fixed,
                        clients: clients,
                    }));

                    value = this.tracker.AttachResponse.Result.ACCEPTED;
                } else {
                    let serverDaemons = await this._daemonRepo.findServerByConnection(connection);
                    let serverDaemon = serverDaemons.length && serverDaemons[0];
                    let serverUsers = serverDaemon ? await this._userRepo.find(serverDaemon.userId) : [];
                    let serverUser = serverUsers.length && serverUsers[0];

                    let {address, port} = this._registry.addressOverride(
                        connection.listenAddress,
                        connection.listenPort,
                        message.attachRequest.addressOverride,
                        message.attachRequest.portOverride
                    );

                    clientConnections.push(this.tracker.ClientConnection.create({
                        name: userEmail + path.path,
                        listenAddress: address,
                        listenPort: port,
                        encrypted: connection.encrypted,
                        fixed: connection.fixed,
                        server: (serverDaemon && serverUser) ? serverUser.email + '?' + serverDaemon.name : '',
                    }));

                    value = this.tracker.AttachResponse.Result.ACCEPTED;
                }
            }

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
        } catch (error) {
            this._logger.error(new NError(error, 'AttachRequest.handle()'));
        }
    }

    /**
     * Add daemon to a connection
     * @param {DaemonModel} daemon
     * @param {ConnectionModel} connection
     * @param {string} actingAs
     * @param {string} addressOverride
     * @param {string} portOverride
     * @return {Promise}
     */
    async connect(daemon, connection, actingAs, addressOverride, portOverride) {
        return this._daemonRepo.connect(daemon, connection, actingAs, addressOverride, portOverride);
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
