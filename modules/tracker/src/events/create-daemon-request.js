/**
 * Create Daemon Request event
 * @module tracker/events/create-daemon-request
 */
const moment = require('moment-timezone');
const NError = require('nerror');

/**
 * Create Daemon Request event class
 */
class CreateDaemonRequest {
    /**
     * Create service
     * @param {App} app                         The application
     * @param {object} config                   Configuration
     * @param {Logger} logger                   Logger service
     * @param {Registry} registry               Registry service
     * @param {Util} util                       Util
     * @param {UserRepository} userRepo         User repository
     * @param {DaemonRepository} daemonRepo     Daemon repository
     */
    constructor(app, config, logger, registry, util, userRepo, daemonRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._util = util;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
    }

    /**
     * Service name is 'tracker.events.createDaemonRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.createDaemonRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'registry', 'util', 'repositories.user', 'repositories.daemon' ];
    }

    /**
     * Event name
     * @type {string}
     */
    get name() {
        return 'create_daemon_request';
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

        this._logger.debug('create-daemon-request', `Got CREATE DAEMON REQUEST from ${id}`);
        try {
            let users = await this._userRepo.findByToken(message.createDaemonRequest.token);
            let user = users.length && users[0];
            if (!user || !user.confirmedAt) {
                let response = this.tracker.CreateDaemonResponse.create({
                    response: this.tracker.CreateDaemonResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.CREATE_DAEMON_RESPONSE,
                    messageId: message.messageId,
                    createDaemonResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('create-daemon-request', `Sending REJECTED CREATE DAEMON RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }
            if (message.createDaemonRequest.daemonName.length && !this._registry.validateName(message.createDaemonRequest.daemonName)) {
                let response = this.tracker.CreateDaemonResponse.create({
                    response: this.tracker.CreateDaemonResponse.Result.INVALID_NAME,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.CREATE_DAEMON_RESPONSE,
                    messageId: message.messageId,
                    createDaemonResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('create-daemon-request', `Sending INVALID_NAME CREATE DAEMON RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            if (!message.createDaemonRequest.daemonName.length) {
                message.createDaemonRequest.daemonName = this._util.getRandomString(4, {
                    lower: true,
                    upper: false,
                    digits: false
                });
                message.createDaemonRequest.randomize = true;
            }

            if (message.createDaemonRequest.randomize) {
                let length = this._util.getRandomInt(3, 6);
                message.createDaemonRequest.daemonName += this._util.getRandomString(length, {
                    lower: false,
                    upper: false,
                    digits: true
                });
            }

            let daemons = await this._daemonRepo.findByUserAndName(user, message.createDaemonRequest.daemonName);
            if (daemons.length) {
                let response = this.tracker.CreateDaemonResponse.create({
                    response: this.tracker.CreateDaemonResponse.Result.NAME_EXISTS,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.CREATE_DAEMON_RESPONSE,
                    messageId: message.messageId,
                    createDaemonResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('create-daemon-request', `Sending NAME_EXISTS CREATE DAEMON RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let daemon = this._daemonRepo.getModel();
            daemon.userId = user.id;
            daemon.name = message.createDaemonRequest.daemonName;
            daemon.token = this._daemonRepo.generateToken();
            daemon.createdAt = moment();
            daemon.blockedAt = null;
            await this._daemonRepo.save(daemon);

            let response = this.tracker.CreateDaemonResponse.create({
                response: this.tracker.CreateDaemonResponse.Result.ACCEPTED,
                daemonName: daemon.name,
                token: daemon.token,
            });
            let reply = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.CREATE_DAEMON_RESPONSE,
                messageId: message.messageId,
                createDaemonResponse: response,
            });
            let data = this.tracker.ServerMessage.encode(reply).finish();
            this._logger.debug('create-daemon-request', `Sending ACCEPTED CREATE DAEMON RESPONSE to ${id}`);
            this.tracker.send(id, data);
        } catch (error) {
            this._logger.error(new NError(error, 'CreateDaemonRequest.handle()'));
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

module.exports = CreateDaemonRequest;
