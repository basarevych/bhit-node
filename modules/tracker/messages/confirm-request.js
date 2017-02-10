/**
 * Confirm Request message
 * @module tracker/messages/confirm-request
 */
const debug = require('debug')('bhit:message');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Confirm Request message class
 */
class ConfirmRequest {
    /**
     * Create service
     * @param {App} app                         The application
     * @param {object} config                   Configuration
     * @param {UserRepository} userRepo         User repository
     * @param {DaemonRepository} daemonRepo     Daemon repository
     */
    constructor(app, config, userRepo, daemonRepo) {
        this._app = app;
        this._config = config;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
    }

    /**
     * Service name is 'modules.tracker.messages.confirmRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.messages.confirmRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'repositories.user', 'repositories.daemon' ];
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

        debug(`Got CONFIRM REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        return this._daemonRepo.findByConfirm(message.confirmRequest.token)
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon) {
                    let response = this.tracker.ConfirmResponse.create({
                        response: this.tracker.ConfirmResponse.Result.REJECTED,
                    });
                    let message = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.CONFIRM_RESPONSE,
                        confirmResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(message).finish();
                    return this.tracker.send(id, data);
                }

                daemon.token = this.tracker.generateToken();
                daemon.confirm = null;
                daemon.confirmedAt = moment();

                return this._daemonRepo.save(daemon)
                    .then(daemonId => {
                        if (!daemonId)
                            throw new Error('Could not save daemon');

                        let response = this.tracker.ConfirmResponse.create({
                            response: this.tracker.ConfirmResponse.Result.ACCEPTED,
                            token: daemon.token,
                        });
                        let message = this.tracker.ServerMessage.create({
                            type: this._tracker.ServerMessage.Type.CONFIRM_RESPONSE,
                            confirmResponse: response,
                        });
                        let data = this.tracker.ServerMessage.encode(message).finish();
                        this._tracker.send(id, data);
                    });
            })
            .catch(error => {
                this._tracker._logger.error(new WError(error, 'ConfirmRequest.onMessage()'));
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