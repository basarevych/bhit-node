/**
 * Status event
 * @module tracker/events/status
 */
const NError = require('nerror');

/**
 * Status event class
 */
class Status {
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
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'tracker.events.status'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.status';
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
     * Event handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    async handle(id, message) {
        let client = this._registry.clients.get(id);
        if (!client)
            return;

        this._logger.debug('status', `Got STATUS from ${id}`);
        try {
            let daemons = [];
            if (client.daemonId)
                daemons = await this._daemonRepo.find(client.daemonId);
            let daemon = daemons.length && daemons[0];
            if (!daemon)
                return;

            let parts = this._registry.validateConnectionName(message.status.connectionName);
            if (!parts)
                return;

            let { email: emailPart, path: pathPart } = parts;

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

            let actingAs = await this._daemonRepo.getActingAs(daemon, connection);
            if (!actingAs)
                return;

            this._registry.updateConnection(
                message.status.connectionName,
                id,
                actingAs,
                message.status.active,
                message.status.connected,
                message.status.internalAddresses
            );

            let ready = this._registry.checkWaiting(message.status.connectionName);
            if (!ready)
                return;

            for (let clientId of ready.targets) {
                let clientInfo = this._registry.clients.get(clientId);
                if (!clientInfo)
                    continue;

                let server = this.tracker.ServerAvailable.create(ready.info);
                let msg = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.SERVER_AVAILABLE,
                    serverAvailable: server,
                });
                let data = this.tracker.ServerMessage.encode(msg).finish();
                this._logger.debug('status', `Sending SERVER AVAILABLE to ${clientId}`);
                this.tracker.send(clientId, data);
            }
        } catch (error) {
            this._logger.error(new NError(error, 'Status.handle()'));
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

module.exports = Status;
