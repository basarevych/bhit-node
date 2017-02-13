/**
 * Disconnect Request message
 * @module tracker/messages/disconnect-request
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Disconnect Request message class
 */
class DisconnectRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {PathRepository} pathRepo                 Path repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, daemonRepo, pathRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'modules.tracker.messages.disconnectRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.messages.disconnectRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'repositories.daemon', 'repositories.path', 'repositories.connection' ];
    }

    /**
     * Message handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    onMessage(id, message) {
        let client = this.tracker.clients.get(id);
        if (!client)
            return;

        debug(`Got DISCONNECT REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        return this._daemonRepo.findByToken(message.disconnectRequest.token)
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

                return this._pathRepo.findByUserAndPath(daemon.userId, message.disconnectRequest.path)
                    .then(paths => {
                        let path = paths.length && paths[0];
                        if (!path) {
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
                            let result = [];
                            return this._connectionRepo.findByPath(path)
                                .then(connections => {
                                    let connection = connections.length && connections[0];
                                    if (connection)
                                        result.push(connection);

                                    return this._pathRepo.findByParent(path)
                                        .then(paths => {
                                            let promises = [];
                                            for (let subPath of paths)
                                                promises.push(loadConnections(subPath));

                                            return Promise.all(promises)
                                                .then(loaded => {
                                                    for (let subConnections of loaded)
                                                        result = result.concat(subConnections);

                                                    return result;
                                                });
                                        })
                                });
                        };

                        return loadConnections(path)
                            .then(connections => {
                                let promises = [];
                                for (let connection of connections)
                                    promises.push(this._daemonRepo.disconnect(daemon, connection));

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
                                        this._tracker.send(id, data);
                                    });
                            });
                    });
            })
            .catch(error => {
                this._tracker._logger.error(new WError(error, 'DisconnectRequest.onMessage()'));
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