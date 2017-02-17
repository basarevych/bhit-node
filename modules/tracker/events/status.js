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
     * @param {UserRepository} userRepo                 User repository
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {PathRepository} pathRepo                 Path repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, userRepo, daemonRepo, pathRepo, connectionRepo) {
        this._app = app;
        this._config = config;
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
        return [ 'app', 'config', 'repositories.user', 'repositories.daemon', 'repositories.path', 'repositories.connection' ];
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
                return this._pathRepo.findByUserAndPath(daemon.userId, pathPart)
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

                                        let status = client.status.get(message.status.connectionName);
                                        if (!status) {
                                            status = {
                                                server: actingAs == 'server',
                                                connected: 0,
                                            };
                                            client.status.set(message.status.connectionName, status);
                                        }
                                        status.connected = message.status.connected;

                                        let waiting = this.tracker.waiting.get(message.status.connectionName);
                                        if (!waiting) {
                                            waiting = {
                                                server: null,
                                                clients: new Set(),
                                            };
                                            this.tracker.waiting.set(message.status.connectionName, waiting);
                                        }
                                        if (actingAs == 'server') {
                                            waiting.server = client.id;
                                        } else {
                                            if (status.connected)
                                                waiting.clients.delete(client.id);
                                            else
                                                waiting.clients.add(client.id);
                                        }
                                    });
                            });
                    });
            })
            .catch(error => {
                this.tracker._logger.error(new WError(error, 'Status.handle()'));
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