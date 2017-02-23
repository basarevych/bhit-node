/**
 * Status event
 * @module tracker/events/status
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Status event class
 */
class Status {
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
     * Service name is 'modules.tracker.events.status'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.status';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'repositories.user', 'repositories.daemon', 'repositories.path', 'repositories.connection' ];
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

        debug(`Got STATUS from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        return Promise.resolve()
            .then(() => {
                if (!client.daemonId)
                    return [];

                return this._daemonRepo.find(client.daemonId);
            })
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon)
                    return;

                let parts = message.status.connectionName.split('/');
                let emailPart = parts.shift();
                let pathPart = '/' + parts.join('/');
                return this._userRepo.findByEmail(emailPart)
                    .then(users => {
                        let user = users.length && users[0];
                        if (!user)
                            return;

                        return this._pathRepo.findByUserAndPath(user, pathPart)
                            .then(paths => {
                                let path = paths.length && paths[0];
                                if (!path)
                                    return;

                                return this._connectionRepo.findByPath(path)
                                    .then(connections => {
                                        let connection = connections.length && connections[0];
                                        if (!connection)
                                            return;

                                        return this._daemonRepo.getActingAs(daemon, connection)
                                            .then(actingAs => {
                                                if (!actingAs)
                                                    return;

                                                if (message.status.active) {
                                                    let status = client.status.get(message.status.connectionName);
                                                    if (!status) {
                                                        status = {
                                                            server: actingAs == 'server',
                                                            connected: 0,
                                                        };
                                                        client.status.set(message.status.connectionName, status);
                                                    }
                                                    status.connected = message.status.connected;
                                                    this._logger.info(`${status.connected} connected to ${client.daemonName} (${actingAs}) in ${message.status.connectionName}`);
                                                } else {
                                                    client.status.delete(message.status.connectionName);
                                                    this._logger.info(`Daemon ${client.daemonName} (${actingAs}) removed from ${message.status.connectionName}`);
                                                }

                                                let waiting = this.tracker.waiting.get(message.status.connectionName);
                                                if (!waiting) {
                                                    waiting = {
                                                        server: null,
                                                        internalAddresses: [],
                                                        clients: new Set(),
                                                    };
                                                    this.tracker.waiting.set(message.status.connectionName, waiting);
                                                }
                                                if (actingAs == 'server') {
                                                    waiting.server = message.status.active ? client.id : null;
                                                    waiting.internalAddresses = message.status.active ? message.status.internalAddresses : [];
                                                } else {
                                                    if (message.status.active) {
                                                        if (status.connected)
                                                            waiting.clients.delete(client.id);
                                                        else
                                                            waiting.clients.add(client.id);
                                                    } else {
                                                        waiting.clients.delete(client.id);
                                                    }
                                                }

                                                if (waiting.internalAddresses.length && waiting.clients.size) {
                                                    let serverInfo = this.tracker.clients.get(waiting.server);
                                                    if (serverInfo) {
                                                        for (let client of waiting.clients) {
                                                            let clientInfo = this.tracker.clients.get(client);
                                                            if (!clientInfo)
                                                                continue;

                                                            let server = this.tracker.ServerAvailable.create({
                                                                connectionName: message.status.connectionName,
                                                                daemonName: serverInfo.daemonName,
                                                                internalAddresses: waiting.internalAddresses,
                                                            });
                                                            let msg = this.tracker.ServerMessage.create({
                                                                type: this.tracker.ServerMessage.Type.SERVER_AVAILABLE,
                                                                serverAvailable: server,
                                                            });
                                                            let data = this.tracker.ServerMessage.encode(msg).finish();
                                                            debug(`Sending SERVER AVAILABLE to ${clientInfo.socket.remoteAddress}:${clientInfo.socket.remotePort}`);
                                                            this.tracker.send(client, data);
                                                        }
                                                    }
                                                    waiting.clients.clear();
                                                }

                                                if (!waiting.internalAddresses.length && !waiting.clients.size)
                                                    this.tracker.waiting.delete(message.status.connectionName);
                                            });
                                    });
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'Status.handle()'));
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

module.exports = Status;