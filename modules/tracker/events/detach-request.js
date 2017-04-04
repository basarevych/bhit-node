/**
 * Detach Request event
 * @module tracker/events/detach-request
 */
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Detach Request event class
 */
class DetachRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {UserRepository} userRepo                 User repository
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {PathRepository} pathRepo                 Path repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     * @param {ConnectionsList} connectionsList         ConnectionsList service
     */
    constructor(app, config, logger, userRepo, daemonRepo, pathRepo, connectionRepo, connectionsList) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
        this._connectionsList = connectionsList;
    }

    /**
     * Service name is 'modules.tracker.events.detachRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.detachRequest';
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
            'repositories.connection',
            'connectionsList'
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

        let userEmail, userPath;
        let parts = message.detachRequest.path.split('/');
        if (parts.length && parts[0].length) {
            userEmail = parts.shift();
            parts.unshift('');
        }
        userPath = parts.join('/');

        this._logger.debug('detach-request', `Got DETACH REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
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
                    let response = this.tracker.DetachResponse.create({
                        response: this.tracker.DetachResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.DETACH_RESPONSE,
                        messageId: message.messageId,
                        detachResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('detach-request', `Sending DETACH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }
                if (!this.tracker.validatePath(userPath)) {
                    let response = this.tracker.DetachResponse.create({
                        response: this.tracker.DetachResponse.Result.INVALID_PATH,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.DETACH_RESPONSE,
                        messageId: message.messageId,
                        detachResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('detach-request', `Sending DETACH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                return this._userRepo.findByEmail(userEmail)
                    .then(users => {
                        let user = users.length && users[0];

                        return Promise.resolve()
                            .then(() => {
                                if (!user)
                                    return [];

                                return this._pathRepo.findByUserAndPath(user, userPath);
                            })
                            .then(paths => {
                                let path = paths.length && paths[0];
                                if (!path || !user) {
                                    let response = this.tracker.DetachResponse.create({
                                        response: this.tracker.DetachResponse.Result.PATH_NOT_FOUND,
                                    });
                                    let reply = this.tracker.ServerMessage.create({
                                        type: this.tracker.ServerMessage.Type.DETACH_RESPONSE,
                                        messageId: message.messageId,
                                        detachResponse: response,
                                    });
                                    let data = this.tracker.ServerMessage.encode(reply).finish();
                                    this._logger.debug('detach-request', `Sending DETACH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                    return this.tracker.send(id, data);
                                }

                                return this._connectionRepo.findByPath(path)
                                    .then(connections => {
                                        let connection = connections.length && connections[0];
                                        if (!connection) {
                                            let response = this.tracker.DetachResponse.create({
                                                response: this.tracker.DetachResponse.Result.PATH_NOT_FOUND,
                                            });
                                            let reply = this.tracker.ServerMessage.create({
                                                type: this.tracker.ServerMessage.Type.DETACH_RESPONSE,
                                                messageId: message.messageId,
                                                detachResponse: response,
                                            });
                                            let data = this.tracker.ServerMessage.encode(reply).finish();
                                            this._logger.debug('detach-request', `Sending DETACH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                            return this.tracker.send(id, data);
                                        }

                                        let name = user.email + path.path;

                                        return this._daemonRepo.disconnect(daemon, connection)
                                            .then(count => {
                                                let info = this.tracker.daemons.get(daemon.id);
                                                if (info) {
                                                    for (let thisClientId of info.clients) {
                                                        let thisClient = this.tracker.clients.get(thisClientId);
                                                        if (thisClient && thisClient.status)
                                                            thisClient.status.delete(name);
                                                    }
                                                    let waiting = this.tracker.waiting.get(name);
                                                    if (waiting) {
                                                        if (waiting.server) {
                                                            let thisServer = this.tracker.clients.get(waiting.server);
                                                            if (!thisServer || !thisServer.status || !thisServer.status.has(name)) {
                                                                waiting.server = null;
                                                                waiting.internalAddresses = [];
                                                            }
                                                        }
                                                        for (let thisClientId of waiting.clients) {
                                                            let thisClient = this.tracker.clients.get(thisClientId);
                                                            if (!thisClient || !thisClient.status || !thisClient.status.has(name))
                                                                waiting.clients.delete(thisClientId);
                                                        }
                                                    }
                                                }

                                                let response = this.tracker.DetachResponse.create({
                                                    response: (count > 0 ?
                                                        this.tracker.DetachResponse.Result.ACCEPTED :
                                                        this.tracker.DetachResponse.Result.NOT_CONNECTED),
                                                });
                                                let reply = this.tracker.ServerMessage.create({
                                                    type: this.tracker.ServerMessage.Type.DETACH_RESPONSE,
                                                    messageId: message.messageId,
                                                    detachResponse: response,
                                                });
                                                let data = this.tracker.ServerMessage.encode(reply).finish();
                                                this._logger.debug('detach-request', `Sending DETACH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                                this.tracker.send(id, data);

                                                if (count > 0) {
                                                    return this._connectionsList.getList(daemon.id)
                                                        .then(list => {
                                                            if (!list)
                                                                return;

                                                            let notification = this.tracker.ServerMessage.create({
                                                                type: this.tracker.ServerMessage.Type.CONNECTIONS_LIST,
                                                                connectionsList: list,
                                                            });
                                                            let data = this.tracker.ServerMessage.encode(notification).finish();

                                                            let info = this.tracker.daemons.get(daemon.id);
                                                            if (info) {
                                                                for (let thisId of info.clients) {
                                                                    let client = this.tracker.clients.get(thisId);
                                                                    if (client) {
                                                                        this._logger.debug('detach-request', `Sending CONNECTIONS LIST to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                                                        this.tracker.send(thisId, data);
                                                                    }
                                                                }
                                                            }
                                                        });
                                                }
                                            })
                                    });
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'DetachRequest.handle()'));
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

module.exports = DetachRequest;