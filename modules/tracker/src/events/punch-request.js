/**
 * Punch Request event
 * @module tracker/events/punch-request
 */
const NError = require('nerror');
const Base = require('./base');

/**
 * Punch Request event class
 */
class PunchRequest extends Base {
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
     * Service name is 'tracker.events.punchRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.punchRequest';
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
        return 'punch_request';
    }

    /**
     * Event handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    async handle(id, message) {
        let client = this._registry.clients.get(id);
        if (!client || !client.daemonId)
            return;

        this._logger.debug('punch-request', `Got PUNCH REQUEST REQUEST from ${id}`);
        try {
            let info = client.connections.get(message.punchRequest.connectionName);
            if (!info || info.server)
                return;

            let target = this._registry.validateConnectionName(message.punchRequest.connectionName);
            if (!target)
                return;

            let { email: emailPart, path: pathPart } = target;

            let users = await this._userRepo.findByEmail(emailPart);
            let user = users.length && users[0];
            if (!user)
                return;

            let paths = await this._pathRepo.findByUserAndPath(user, pathPart);
            let path = paths.length && paths[0];
            if (!path)
                return;

            let connections = await this._connectionRepo.findByPath(path);
            let connection = connections.length && connections[0];
            if (!connection)
                return;

            let daemons = await this._daemonRepo.findServerByConnection(connection);
            let daemon = daemons.length && daemons[0];
            if (!daemon)
                return;

            info = this._registry.daemons.get(daemon.id);
            if (!info)
                return;

            let clientId = id;
            let serverId;
            for (let id of info.clients) {
                let clientInfo = this._registry.clients.get(id);
                if (!clientInfo)
                    continue;
                let connectionInfo = clientInfo.connections.get(message.punchRequest.connectionName);
                if (!connectionInfo)
                    continue;
                if (connectionInfo.server) {
                    serverId = id;
                    break;
                }
            }
            if (!serverId)
                return;

            let pair = this._registry.createPair(message.punchRequest.connectionName, serverId, clientId);

            let request = this.tracker.AddressRequest.create({
                connectionName: pair.connectionName,
                requestId: pair.clientRequestId,
            });
            let msg = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.ADDRESS_REQUEST,
                addressRequest: request,
            });
            let data = this.tracker.ServerMessage.encode(msg).finish();
            this._logger.debug('punch-request', `Sending ADDRESS REQUEST to ${clientId}`);
            this.tracker.send(clientId, data);

            request = this.tracker.AddressRequest.create({
                connectionName: pair.connectionName,
                requestId: pair.serverRequestId,
            });
            msg = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.ADDRESS_REQUEST,
                addressRequest: request,
            });
            data = this.tracker.ServerMessage.encode(msg).finish();
            this._logger.debug('punch-request', `Sending ADDRESS REQUEST to ${serverId}`);
            this.tracker.send(serverId, data);
        } catch (error) {
            this._logger.error(new NError(error, 'PunchRequest.handle()'));
        }
    }
}

module.exports = PunchRequest;
