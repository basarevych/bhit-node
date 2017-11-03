/**
 * Create Request event
 * @module tracker/events/create-request
 */
const NError = require('nerror');

/**
 * Create Request event class
 */
class CreateRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {Registry} registry                       Registry service
     * @param {UserRepository} userRepo                 User repository
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, logger, registry, userRepo, daemonRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'tracker.events.createRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.createRequest';
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
            'repositories.connection',
        ];
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

        this._logger.debug('create-request', `Got CREATE REQUEST from ${id}`);
        try {
            let users = await this._userRepo.findByToken(message.createRequest.token);
            let user = users.length && users[0];
            if (!user) {
                let response = this.tracker.CreateResponse.create({
                    response: this.tracker.CreateResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.CREATE_RESPONSE,
                    messageId: message.messageId,
                    createResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('redeem-path-request', `Sending REJECTED CREATE RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let daemons = [];
            if (client.daemonId)
                daemons = await this._daemonRepo.find(client.daemonId);
            let daemon = daemons.length && daemons[0];
            if (!daemon) {
                let response = this.tracker.CreateResponse.create({
                    response: this.tracker.CreateResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.CREATE_RESPONSE,
                    messageId: message.messageId,
                    createResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('redeem-path-request', `Sending REJECTED CREATE RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let path = this._registry.validatePath(message.createRequest.path);
            if (!path || (path.email && path.email !== user.email)) {
                let response = this.tracker.CreateResponse.create({
                    response: this.tracker.CreateResponse.Result.INVALID_PATH,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.CREATE_RESPONSE,
                    messageId: message.messageId,
                    createResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('create-request', `Sending INVALID_PATH CREATE RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }
            path = path.path;

            if (!message.createRequest.connectPort ||
                message.createRequest.connectAddress === '*' || message.createRequest.connectPort === '*' ||
                (!message.createRequest.connectAddress && message.createRequest.connectPort[0] !== '/') ||
                (message.createRequest.connectAddress && message.createRequest.connectPort[0] === '/') ||
                (message.createRequest.listenPort && message.createRequest.listenPort[0] === '/' && message.createRequest.listenAddress)) {
                let response = this.tracker.CreateResponse.create({
                    response: this.tracker.CreateResponse.Result.INVALID_ADDRESS,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.CREATE_RESPONSE,
                    messageId: message.messageId,
                    createResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('create-request', `Sending INVALID_ADDRESS CREATE RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let connection = this._connectionRepo.getModel();
            connection.userId = user.id;
            connection.token = this._connectionRepo.generateToken();
            connection.encrypted = message.createRequest.encrypted;
            connection.fixed = message.createRequest.fixed;
            connection.connectAddress = message.createRequest.connectAddress || null;
            connection.connectPort = message.createRequest.connectPort;
            connection.listenAddress = message.createRequest.listenPort ? message.createRequest.listenAddress || null : null;
            connection.listenPort = message.createRequest.listenPort || null;
            let result = await this._connectionRepo.createByPath(path, connection);
            if (!result || !result.path || !result.connection) {
                let response = this.tracker.CreateResponse.create({
                    response: this.tracker.CreateResponse.Result.PATH_EXISTS,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.CREATE_RESPONSE,
                    messageId: message.messageId,
                    createResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('create-request', `Sending PATH_EXISTS CREATE RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let serverConnections = [];
            let clientConnections = [];
            if (daemon && message.createRequest.type !== this.tracker.CreateRequest.Type.NOT_CONNECTED) {
                let numConnections = await this._daemonRepo.connect(
                    daemon,
                    connection,
                    message.createRequest.type === this.tracker.CreateRequest.Type.SERVER ? 'server' : 'client'
                );
                if (numConnections) {
                    if (message.createRequest.type === this.tracker.CreateRequest.Type.SERVER) {
                        serverConnections.push(this.tracker.ServerConnection.create({
                            name: user.email + path,
                            connectAddress: connection.connectAddress,
                            connectPort: connection.connectPort,
                            encrypted: connection.encrypted,
                            fixed: connection.fixed,
                            clients: [],
                        }));
                    } else {
                        clientConnections.push(this.tracker.ClientConnection.create({
                            name: user.email + path,
                            listenAddress: connection.listenAddress,
                            listenPort: connection.listenPort,
                            encrypted: connection.encrypted,
                            fixed: connection.fixed,
                            server: '',
                        }));
                    }
                }
            }

            let list = this.tracker.ConnectionsList.create({
                serverConnections: serverConnections,
                clientConnections: clientConnections,
            });
            let response = this.tracker.CreateResponse.create({
                response: this.tracker.CreateResponse.Result.ACCEPTED,
                serverToken: result.connection.token,
                clientToken: result.path.token,
                updates: list,
            });
            let reply = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.CREATE_RESPONSE,
                messageId: message.messageId,
                createResponse: response,
            });
            let data = this.tracker.ServerMessage.encode(reply).finish();
            this._logger.debug('create-request', `Sending ACCEPTED CREATE RESPONSE to ${id}`);
            this.tracker.send(id, data);
        } catch (error) {
            this._logger.error(new NError(error, 'CreateRequest.handle()'));
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

module.exports = CreateRequest;
