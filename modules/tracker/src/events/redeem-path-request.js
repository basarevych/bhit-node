/**
 * Redeem Path Request event
 * @module tracker/events/redeem-path-request
 */
const NError = require('nerror');

/**
 * Redeem Path Request event class
 */
class RedeemPathRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {Util} util                               Util service
     * @param {Registry} registry                       Registry service
     * @param {UserRepository} userRepo                 User repository
     * @param {PathRepository} pathRepo                 Path repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, logger, util, registry, userRepo, pathRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._util = util;
        this._registry = registry;
        this._userRepo = userRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'tracker.events.redeemPathRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.redeemPathRequest';
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
            'registry',
            'repositories.user',
            'repositories.path',
            'repositories.connection'
        ];
    }

    /**
     * Event name
     * @type {string}
     */
    get name() {
        return 'redeem_path_request';
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

        this._logger.debug('redeem-path-request', `Got REDEEM PATH REQUEST from ${id}`);
        try {
            let users = await this._userRepo.findByToken(message.redeemPathRequest.token);
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
                this._logger.debug('redeem-path-request', `Sending REJECTED REDEEM PATH RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let paths = await this._pathRepo.findByUserAndPath(user, message.redeemPathRequest.path);
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
                this._logger.debug('redeem-path-request', `Sending REJECTED REDEEM PATH RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let token;
            if (message.redeemPathRequest.type === this.tracker.RedeemPathRequest.Type.CLIENT) {
                path.token = this._pathRepo.generateToken();
                await this._pathRepo.save(path);
                token = path.token;
            } else {
                let connections = await this._connectionRepo.findByPath(path);
                let connection = connections.length && connections[0];
                if (connection) {
                    connection.token = this._connectionRepo.generateToken();
                    await this._connectionRepo.save(connection);
                    token = connection.token;
                }
            }

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
            this._logger.debug('redeem-path-request', `Sending RESULTING REDEEM PATH RESPONSE to ${id}`);
            this.tracker.send(id, data);
        } catch (error) {
            this._logger.error(new NError(error, 'RedeemPathRequest.handle()'));
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

module.exports = RedeemPathRequest;
