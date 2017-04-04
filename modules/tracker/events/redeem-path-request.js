/**
 * Redeem Path Request event
 * @module tracker/events/redeem-path-request
 */
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Redeem Path Request event class
 */
class RedeemPathRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {Util} util                               Util
     * @param {UserRepository} userRepo                 User repository
     * @param {PathRepository} pathRepo                 Path repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, logger, util, userRepo, pathRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._util = util;
        this._userRepo = userRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'modules.tracker.events.redeemPathRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.redeemPathRequest';
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
            'util',
            'repositories.user',
            'repositories.path',
            'repositories.connection'
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

        this._logger.debug('redeem-path-request', `Got REDEEM PATH REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        this._userRepo.findByToken(message.redeemPathRequest.token)
            .then(users => {
                let user = users.length && users[0];
                if (!user) {
                    let response = this.tracker.RedeemPathResponse.create({
                        response: this.tracker.RedeemPathResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.REDEEM_PATH_RESPONSE,
                        messageId: message.messageId,
                        redeemPathResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('redeem-path-request', `Sending REDEEM PATH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                return this._pathRepo.findByUserAndPath(user, message.redeemPathRequest.path)
                    .then(paths => {
                        let path = paths.length && paths[0];
                        if (!path) {
                            let response = this.tracker.RedeemPathResponse.create({
                                response: this.tracker.RedeemPathResponse.Result.REJECTED,
                            });
                            let reply = this.tracker.ServerMessage.create({
                                type: this.tracker.ServerMessage.Type.REDEEM_PATH_RESPONSE,
                                messageId: message.messageId,
                                redeemPathResponse: response,
                            });
                            let data = this.tracker.ServerMessage.encode(reply).finish();
                            this._logger.debug('redeem-path-request', `Sending REDEEM PATH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                            return this.tracker.send(id, data);
                        }

                        return Promise.resolve()
                            .then(() => {
                                if (message.redeemPathRequest.type === this.tracker.RedeemPathRequest.Type.CLIENT) {
                                    path.token = this.tracker.generateToken();
                                    return this._pathRepo.save(path)
                                        .then(pathId => {
                                            if (!pathId)
                                                throw new Error('Could not update path');

                                            return path.token;
                                        });
                                }

                                return this._connectionRepo.findByPath(path)
                                    .then(connections => {
                                        let connection = connections.length && connections[0];
                                        if (!connection)
                                            return null;

                                        connection.token = this.tracker.generateToken();
                                        return this._connectionRepo.save(connection)
                                            .then(connectionId => {
                                                if (!connectionId)
                                                    throw new Error('Could not update connection');

                                                return connection.token;
                                            });
                                    });
                            })
                            .then(token => {
                                let response;
                                if (token) {
                                    response = this.tracker.RedeemPathResponse.create({
                                        response: this.tracker.RedeemPathResponse.Result.ACCEPTED,
                                        token: token,
                                    });
                                } else {
                                    response = this.tracker.RedeemPathResponse.create({
                                        response: this.tracker.RedeemPathResponse.Result.REJECTED,
                                    });
                                }
                                let reply = this.tracker.ServerMessage.create({
                                    type: this.tracker.ServerMessage.Type.REDEEM_PATH_RESPONSE,
                                    messageId: message.messageId,
                                    redeemPathResponse: response,
                                });
                                let data = this.tracker.ServerMessage.encode(reply).finish();
                                this._logger.debug('redeem-path-request', `Sending REDEEM PATH RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                this.tracker.send(id, data);
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'RedeemPathRequest.handle()'));
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

module.exports = RedeemPathRequest;