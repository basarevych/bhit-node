/**
 * Connect Request event
 * @module tracker/events/connect-request
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Connect Request event class
 */
class ConnectRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {PathRepository} pathRepo                 Path repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, logger, daemonRepo, pathRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'modules.tracker.events.connectRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.connectRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'repositories.daemon', 'repositories.path', 'repositories.connection' ];
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

        debug(`Got CONNECT REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
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
                if (!message.connectRequest.daemonName)
                    return daemon;

                return this._daemonRepo.findByUserAndName(daemon.userId, message.connectRequest.daemonName)
                    .then(daemons => {
                        return daemons.length && daemons[0];
                    });
            })
            .then(daemon => {
                if (!daemon) {
                    let response = this.tracker.ConnectResponse.create({
                        response: this.tracker.ConnectResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.CONNECT_RESPONSE,
                        messageId: message.messageId,
                        connectResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    debug(`Sending CONNECT RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                return Promise.all([
                        this._pathRepo.findByToken(message.connectRequest.connectToken),
                        this._connectionRepo.findByToken(message.connectRequest.connectToken)
                    ])
                    .then(([ paths, connections ]) => {
                        let path = paths.length && paths[0];
                        let connection = connections.length && connections[0];

                        let actingAs;
                        if (path) {
                            actingAs = 'client';
                        } else if (connection) {
                            actingAs = 'server';
                        } else {
                            let response = this.tracker.ConnectResponse.create({
                                response: this.tracker.ConnectResponse.Result.REJECTED,
                            });
                            let reply = this.tracker.ServerMessage.create({
                                type: this.tracker.ServerMessage.Type.CONNECT_RESPONSE,
                                messageId: message.messageId,
                                connectResponse: response,
                            });
                            let data = this.tracker.ServerMessage.encode(reply).finish();
                            debug(`Sending CONNECT RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
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

                        return Promise.resolve()
                            .then(() => {
                                if (actingAs == 'server')
                                    return [ connection ];

                                return loadConnections(path);
                            })
                            .then(connections => {
                                let promises = [];
                                for (let connection of connections)
                                    promises.push(this._daemonRepo.connect(daemon, connection, actingAs));

                                return Promise.all(promises)
                                    .then(result => {
                                        let count = result.reduce((prev, cur) => prev + cur, 0);
                                        let response = this.tracker.ConnectResponse.create({
                                            response: (count > 0 ?
                                                this.tracker.ConnectResponse.Result.ACCEPTED :
                                                this.tracker.ConnectResponse.Result.ALREADY_CONNECTED),
                                        });
                                        let reply = this.tracker.ServerMessage.create({
                                            type: this._tracker.ServerMessage.Type.CONNECT_RESPONSE,
                                            messageId: message.messageId,
                                            connectResponse: response,
                                        });
                                        let data = this.tracker.ServerMessage.encode(reply).finish();
                                        debug(`Sending CONNECT RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                        this.tracker.send(id, data);
                                    });
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'ConnectRequest.handle()'));
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

module.exports = ConnectRequest;