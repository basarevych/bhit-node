/**
 * Confirm Request event
 * @module tracker/events/confirm-request
 */
const moment = require('moment-timezone');
const NError = require('nerror');

/**
 * Confirm Request event class
 */
class ConfirmRequest {
    /**
     * Create service
     * @param {App} app                         The application
     * @param {object} config                   Configuration
     * @param {Logger} logger                   Logger service
     * @param {Registry} registry               Registry service
     * @param {UserRepository} userRepo         User repository
     */
    constructor(app, config, logger, registry, userRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._userRepo = userRepo;
    }

    /**
     * Service name is 'modules.tracker.events.confirmRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.confirmRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'registry', 'repositories.user' ];
    }

    /**
     * Event handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    handle(id, message) {
        let client = this._registry.clients.get(id);
        if (!client)
            return;

        this._logger.debug('confirm-request', `Got CONFIRM REQUEST from ${id}`);
        return this._userRepo.findByConfirm(message.confirmRequest.token)
            .then(users => {
                let user = users.length && users[0];
                if (!user) {
                    let response = this.tracker.ConfirmResponse.create({
                        response: this.tracker.ConfirmResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.CONFIRM_RESPONSE,
                        messageId: message.messageId,
                        confirmResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('confirm-request', `Sending REJECTED CONFIRM RESPONSE to ${id}`);
                    return this.tracker.send(id, data);
                }

                user.token = this._userRepo.generateToken();
                user.confirm = null;
                user.confirmedAt = moment();

                return this._userRepo.save(user)
                    .then(() => {
                        let response = this.tracker.ConfirmResponse.create({
                            response: this.tracker.ConfirmResponse.Result.ACCEPTED,
                            token: user.token,
                        });
                        let reply = this.tracker.ServerMessage.create({
                            type: this.tracker.ServerMessage.Type.CONFIRM_RESPONSE,
                            messageId: message.messageId,
                            confirmResponse: response,
                        });
                        let data = this.tracker.ServerMessage.encode(reply).finish();
                        this._logger.debug('confirm-request', `Sending ACCEPTED CONFIRM RESPONSE to ${id}`);
                        this.tracker.send(id, data);
                    });
            })
            .catch(error => {
                this._logger.error(new NError(error, 'ConfirmRequest.handle()'));
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

module.exports = ConfirmRequest;