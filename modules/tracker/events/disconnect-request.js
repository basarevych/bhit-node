/**
 * Disconnect Request event
 * @module tracker/events/disconnect-request
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Disconnect Request event class
 */
class DisconnectRequest {
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
     * Service name is 'modules.tracker.events.disconnectRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.disconnectRequest';
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

        debug(`Got DISCONNECT REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        return Promise.resolve()
            .then(() => {
                if (!client.daemonId)
                    return [];

                return this._daemonRepo.find(client.daemonId);
            })
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon)
                    return null;
                if (!message.disconnectRequest.daemonName)
                    return daemon;

                return this._daemonRepo.findByUserAndName(daemon.userId, message.disconnectRequest.daemonName)
                    .then(daemons => {
                        return daemons.length && daemons[0];
                    });
            })
            .then(daemon => {
                if (!daemon) {
                    let response = this.tracker.DisconnectResponse.create({
                        response: this.tracker.DisconnectResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.DISCONNECT_RESPONSE,
                        messageId: message.messageId,
                        disconnectResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    debug(`Sending DISCONNECT RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }
                if (!this.tracker.validatePath(message.disconnectRequest.path)) {
                    let response = this.tracker.DisconnectResponse.create({
                        response: this.tracker.DisconnectResponse.Result.INVALID_PATH,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.DISCONNECT_RESPONSE,
                        messageId: message.messageId,
                        disconnectResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    debug(`Sending DISCONNECT RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                return Promise.all([
                        this._pathRepo.findByUserAndPath(daemon.userId, message.disconnectRequest.path),
                        this._userRepo.find(daemon.userId),
                    ])
                    .then(([ paths, users ]) => {
                        let path = paths.length && paths[0];
                        let user = users.length && users[0];
                        if (!path || !user) {
                            let response = this.tracker.DisconnectResponse.create({
                                response: this.tracker.DisconnectResponse.Result.PATH_NOT_FOUND,
                            });
                            let reply = this.tracker.ServerMessage.create({
                                type: this.tracker.ServerMessage.Type.DISCONNECT_RESPONSE,
                                messageId: message.messageId,
                                disconnectResponse: response,
                            });
                            let data = this.tracker.ServerMessage.encode(reply).finish();
                            debug(`Sending DISCONNECT RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                            return this.tracker.send(id, data);
                        }

                        let loadConnections = path => {
                            let resultConnections = [], resultNames = [];
                            return this._connectionRepo.findByPath(path)
                                .then(connections => {
                                    let connection = connections.length && connections[0];
                                    if (connection) {
                                        resultConnections.push(connection);
                                        resultNames.push(user.email + path.path);
                                    }

                                    return this._pathRepo.findByParent(path)
                                        .then(paths => {
                                            let promises = [];
                                            for (let subPath of paths)
                                                promises.push(loadConnections(subPath));

                                            return Promise.all(promises)
                                                .then(([ loadedConnections, loadedNames ]) => {
                                                    for (let subConnections of loadedConnections)
                                                        resultConnections = resultConnections.concat(subConnections);
                                                    for (let subName of loadedNames)
                                                        resultNames = resultNames.concat(subName);

                                                    return [ resultConnections, resultNames ];
                                                });
                                        })
                                });
                        };

                        return loadConnections(path)
                            .then(([ connections, names ]) => {
                                let promises = [];
                                for (let connection of connections)
                                    promises.push(this._daemonRepo.disconnect(daemon, connection));

                                let info = this.tracker.daemons.get(daemon.id);
                                if (info) {
                                    for (let thisClientId of info.clients) {
                                        let thisClient = this.tracker.clients.get(thisClientId);
                                        if (thisClient && thisClient.status) {
                                            for (let name of names)
                                                thisClient.status.delete(name);
                                        }
                                    }
                                    for (let name of names) {
                                        let waiting = this.tracker.waiting.get(name);
                                        if (waiting) {
                                            if (waiting.server) {
                                                let thisServer = this.tracker.clients.get(waiting.server);
                                                if (!thisServer || !thisServer.status || !thisServer.status.has(name))
                                                    waiting.server = null;
                                            }
                                            for (let thisClientId of waiting.clients) {
                                                let thisClient = this.tracker.clients.get(thisClientId);
                                                if (!thisClient || !thisClient.status || !thisClient.status.has(name))
                                                    waiting.clients.delete(thisClientId);
                                            }
                                        }
                                    }
                                }

                                return Promise.all(promises)
                                    .then(result => {
                                        let count = result.reduce((prev, cur) => prev + cur, 0);
                                        let response = this.tracker.DisconnectResponse.create({
                                            response: (count > 0 ?
                                                this.tracker.DisconnectResponse.Result.ACCEPTED :
                                                this.tracker.DisconnectResponse.Result.NOT_CONNECTED),
                                        });
                                        let reply = this.tracker.ServerMessage.create({
                                            type: this._tracker.ServerMessage.Type.DISCONNECT_RESPONSE,
                                            messageId: message.messageId,
                                            disconnectResponse: response,
                                        });
                                        let data = this.tracker.ServerMessage.encode(reply).finish();
                                        debug(`Sending DISCONNECT RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                        this.tracker.send(id, data);
                                    });
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'DisconnectRequest.handle()'));
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

module.exports = DisconnectRequest;