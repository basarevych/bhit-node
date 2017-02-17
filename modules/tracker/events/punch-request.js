/**
 * Punch Request event
 * @module tracker/events/punch-request
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const uuid = require('uuid');
const WError = require('verror').WError;

/**
 * Punch Request event class
 */
class PunchRequest {
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
     * Service name is 'modules.tracker.events.punchRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.punchRequest';
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
        if (!client || !client.daemonId)
            return;

        let info = client.status.get(message.punchRequest.connectionName);
        if (!info || info.server)
            return;

        debug(`Got PUNCH REQUEST REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        let parts = message.punchRequest.connectionName.split('/');
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

                                return this._daemonRepo.findServerByConnection(connection)
                                    .then(daemons => {
                                        let daemon = daemons.length && daemons[0];
                                        if (!daemon)
                                            return;

                                        let info = this.tracker.daemons.get(daemon.id);
                                        if (!info)
                                            return;

                                        let clientId = id, serverId;
                                        for (let id of info.clients) {
                                            let clientInfo = this.tracker.clients.get(id);
                                            if (!clientInfo)
                                                continue;
                                            let statusInfo = clientInfo.status.get(message.punchRequest.connectionName);
                                            if (!statusInfo)
                                                continue;
                                            if (statusInfo.server) {
                                                serverId = id;
                                                info = clientInfo;
                                                break;
                                            }
                                        }
                                        if (!serverId)
                                            return;

                                        let clientRequestId = uuid.v1(), serverRequestId = uuid.v1();
                                        let pair = {
                                            timestamp: Date.now() + this.tracker.constructor.addressTimeout,
                                            connectionName: message.punchRequest.connectionName,
                                            clientId: clientId,
                                            clientRequestId: clientRequestId,
                                            clientAddress: null,
                                            clientPort: null,
                                            serverId: serverId,
                                            serverRequestId: serverRequestId,
                                            serverAddress: null,
                                            serverPort: null,
                                        };
                                        this.tracker.pairs.set(clientRequestId, pair);
                                        this.tracker.pairs.set(serverRequestId, pair);

                                        let request = this.tracker.AddressRequest.create({
                                            connectionName: pair.connectionName,
                                            requestId: clientRequestId,
                                        });
                                        let msg = this.tracker.ServerMessage.create({
                                            type: this.tracker.ServerMessage.Type.ADDRESS_REQUEST,
                                            addressRequest: request,
                                        });
                                        let data = this.tracker.ServerMessage.encode(msg).finish();
                                        debug(`Sending ADDRESS REQUEST to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                        this.tracker.send(clientId, data);

                                        request = this.tracker.AddressRequest.create({
                                            connectionName: pair.connectionName,
                                            requestId: serverRequestId,
                                        });
                                        msg = this.tracker.ServerMessage.create({
                                            type: this.tracker.ServerMessage.Type.ADDRESS_REQUEST,
                                            addressRequest: request,
                                        });
                                        data = this.tracker.ServerMessage.encode(msg).finish();
                                        debug(`Sending ADDRESS REQUEST to ${info.socket.remoteAddress}:${info.socket.remotePort}`);
                                        this.tracker.send(serverId, data);
                                    });
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'PunchRequest.handle()'));
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

module.exports = PunchRequest;