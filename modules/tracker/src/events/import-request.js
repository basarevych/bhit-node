/**
 * Import Request event
 * @module tracker/events/import-request
 */
const NError = require('nerror');
const Base = require('./base');

/**
 * Import Request event class
 */
class ImportRequest extends Base {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {Registry} registry                       Registry service
     * @param {UserRepository} userRepo                 User repository
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {PathRepository} pathRepo                 Path repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, logger, registry, userRepo, daemonRepo, pathRepo, connectionRepo) {
        super(app);
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'tracker.events.importRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.importRequest';
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
        return 'import_request';
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

        this._logger.debug('import-request', `Got IMPORT REQUEST from ${id}`);
        try {
            let daemons = [];
            if (client.daemonId)
                daemons = await this._daemonRepo.find(client.daemonId);
            let daemon = daemons.length && daemons[0];
            if (!daemon) {
                let response = this.tracker.ImportResponse.create({
                    response: this.tracker.ImportResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.IMPORT_RESPONSE,
                    messageId: message.messageId,
                    importResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('import-request', `Sending REJECTED IMPORT RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let [paths, connections] = await Promise.all([
                this._pathRepo.findByToken(message.importRequest.token),
                this._connectionRepo.findByToken(message.importRequest.token)
            ]);
            let path = paths.length && paths[0];
            let connection = connections.length && connections[0];

            let userId, actingAs;
            if (path) {
                actingAs = 'client';
                userId = path.userId;
            } else if (connection) {
                actingAs = 'server';
                userId = connection.userId;
            } else {
                let response = this.tracker.ImportResponse.create({
                    response: this.tracker.ImportResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.IMPORT_RESPONSE,
                    messageId: message.messageId,
                    importResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('import-request', `Sending REJECTED IMPORT RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let loadConnections = async path => {
                let result = [];
                let connections = await this._connectionRepo.findByPath(path);
                let connection = connections.length && connections[0];
                if (connection)
                    result.push(connection);

                let paths = await this._pathRepo.findByParent(path);
                let promises = [];
                for (let subPath of paths)
                    promises.push(loadConnections(subPath));

                let loaded = await Promise.all(promises);
                for (let subConnections of loaded)
                    result = result.concat(subConnections);

                return result;
            };

            if (actingAs === 'server')
                connections = [connection];
            else
                connections = await loadConnections(path);

            let serverConnections = [];
            let clientConnections = [];
            let value;

            let users = await this._userRepo.find(userId);
            let user = users.length && users[0];
            if (!user) {
                value = this.tracker.ImportResponse.Result.REJECTED;
            } else {
                value = this.tracker.ImportResponse.Result.ACCEPTED;
                if (actingAs === 'server') {
                    let connection = connections.length && connections[0];
                    if (connection) {
                        let paths = await this._pathRepo.find(connection.pathId);
                        let path = paths.length && paths[0];
                        if (path) {
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
                                connection.addressOverride,
                                connection.portOverride
                            );

                            serverConnections.push(this.tracker.ServerConnection.create({
                                name: user.email + path.path,
                                connectAddress: address,
                                connectPort: port,
                                encrypted: connection.encrypted,
                                fixed: connection.fixed,
                                clients: clients,
                            }));
                        }
                    }
                } else {
                    for (let connection of connections) {
                        let paths = await this._pathRepo.find(connection.pathId);
                        let path = paths.length && paths[0];
                        if (path) {
                            let serverDaemons = await this._daemonRepo.findServerByConnection(connection);
                            let serverDaemon = serverDaemons.length && serverDaemons[0];

                            let serverUsers = [];
                            if (serverDaemon)
                                serverUsers = await this._userRepo.find(serverDaemon.userId);
                            let serverUser = serverUsers.length && serverUsers[0];

                            let {address, port} = this._registry.addressOverride(
                                connection.listenAddress,
                                connection.listenPort,
                                connection.addressOverride,
                                connection.portOverride
                            );

                            clientConnections.push(this.tracker.ClientConnection.create({
                                name: user.email + path.path,
                                listenAddress: address,
                                listenPort: port,
                                encrypted: connection.encrypted,
                                fixed: connection.fixed,
                                server: (serverDaemon && serverUser) ? serverUser.email + '?' + serverDaemon.name : '',
                            }));
                        }
                    }
                }
            }

            let list = this.tracker.ConnectionsList.create({
                serverConnections: serverConnections,
                clientConnections: clientConnections,
            });
            let response = this.tracker.ImportResponse.create({
                response: value,
                updates: list,
            });
            let reply = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.IMPORT_RESPONSE,
                messageId: message.messageId,
                importResponse: response,
            });
            let data = this.tracker.ServerMessage.encode(reply).finish();
            this._logger.debug('import-request', `Sending RESULTING IMPORT RESPONSE to ${id}`);
            this.tracker.send(id, data);
        } catch (error) {
            this._logger.error(new NError(error, 'ImportRequest.handle()'));
        }
    }
}

module.exports = ImportRequest;
