/**
 * Confirm Request event
 * @module tracker/events/confirm-request
 */
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Confirm Request event class
 */
class ConfirmRequest {
    /**
     * Create service
     * @param {App} app                         The application
     * @param {object} config                   Configuration
     * @param {Logger} logger                   Logger service
     * @param {UserRepository} userRepo         User repository
     */
    constructor(app, config, logger, userRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
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
        return [ 'app', 'config', 'logger', 'repositories.user' ];
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

        this._logger.debug('confirm-request', `Got CONFIRM REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
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
                    this._logger.debug('confirm-request', `Sending CONFIRM RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                user.token = this.tracker.generateToken();
                user.confirm = null;
                user.confirmedAt = moment();

                return this._userRepo.save(user)
                    .then(userId => {
                        if (!userId)
                            throw new Error('Could not save user');

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
                        this._logger.debug('confirm-request', `Sending CONFIRM RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                        this.tracker.send(id, data);
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'ConfirmRequest.handle()'));
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