/**
 * Create Request message
 * @module tracker/messages/create-request
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Create Request message class
 */
class CreateRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, daemonRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._daemonRepo = daemonRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'modules.tracker.messages.createRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.messages.createRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'repositories.daemon', 'repositories.connection' ];
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

        debug(`Got CREATE REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        return this._daemonRepo.findByToken(message.createRequest.token)
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon)
                    return null;
                if (!message.createRequest.daemonName)
                    return daemon;

                return this._daemonRepo.findByUserAndName(daemon.userId, message.createRequest.daemonName)
                    .then(daemons => {
                        return daemons.length && daemons[0];
                    });
            })
            .then(daemon => {
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
                    return this.tracker.send(id, data);
                }
                if (!this.tracker.validatePath(message.createRequest.path)) {
                    let response = this.tracker.CreateResponse.create({
                        response: this.tracker.CreateResponse.Result.INVALID_PATH,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.CREATE_RESPONSE,
                        messageId: message.messageId,
                        createResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    return this.tracker.send(id, data);
                }

                let connection = this._connectionRepo.create();
                connection.userId = daemon.userId;
                connection.token = this._connectionRepo.generateToken();
                connection.encrypted = message.createRequest.encrypted;
                connection.connectAddress = message.createRequest.connectAddress;
                connection.connectPort = message.createRequest.connectPort;
                connection.listenAddress = message.createRequest.listenAddress;
                connection.listenPort = message.createRequest.listenPort;
                return this._connectionRepo.createByPath(message.createRequest.path, connection)
                    .then(result => {
                        if (!result.path || !result.connection) {
                            let response = this.tracker.CreateResponse.create({
                                response: this.tracker.CreateResponse.Result.PATH_EXISTS,
                            });
                            let reply = this.tracker.ServerMessage.create({
                                type: this.tracker.ServerMessage.Type.CREATE_RESPONSE,
                                messageId: message.messageId,
                                createResponse: response,
                            });
                            let data = this.tracker.ServerMessage.encode(reply).finish();
                            return this.tracker.send(id, data);
                        }

                        return this._daemonRepo.connect(daemon, connection, this.tracker.CreateRequest.Type.SERVER ? 'server' : 'client')
                            .then(() => {
                                let response = this.tracker.CreateResponse.create({
                                    response: this.tracker.CreateResponse.Result.ACCEPTED,
                                    serverToken: result.connection.token,
                                    clientToken: result.path.token,
                                });
                                let reply = this.tracker.ServerMessage.create({
                                    type: this._tracker.ServerMessage.Type.CREATE_RESPONSE,
                                    messageId: message.messageId,
                                    createResponse: response,
                                });
                                let data = this.tracker.ServerMessage.encode(reply).finish();
                                this._tracker.send(id, data);
                            });
                    });
            })
            .catch(error => {
                this._tracker._logger.error(new WError(error, 'CreateRequest.onMessage()'));
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

module.exports = CreateRequest;