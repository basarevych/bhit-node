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
     * @param {Tracker} tracker                 Tracker server
     * @param {object} config                   Configuration
     * @param {Logger} logger                   Logger
     * @param {UserRepository} userRepo         User repository
     * @param {DaemonRepository} daemonRepo     Daemon repository
     */
    constructor(tracker, config, logger, userRepo, daemonRepo) {
        this._tracker = tracker;
        this._config = config;
        this._logger = logger;
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
        return [ 'servers.tracker', 'config', 'logger', 'repositories.user', 'repositories.daemon' ];
    }

    /**
     * Message handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    onMessage(id, message) {
        let client = this._tracker.clients.get(id);
        if (!client)
            return;

        debug(`Got CONFIRM REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        return this._daemonRepo.findByConfirm(message.confirmRequest.token)
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon) {
                    let response = this._tracker.ConfirmResponse.create({
                        response: this._tracker.ConfirmResponse.Result.REJECTED,
                    });
                    let message = this._tracker.ServerMessage.create({
                        type: this._tracker.ServerMessage.Type.CONFIRM_RESPONSE,
                        confirmResponse: response,
                    });
                    let data = this._tracker.ServerMessage.encode(message).finish();
                    return this._tracker.send(id, data);
                }

                daemon.token = this._tracker.generateToken();
                daemon.confirm = null;
                daemon.confirmedAt = moment();

                return this._daemonRepo.save(daemon)
                    .then(daemonId => {
                        if (!daemonId)
                            throw new Error('Could not save daemon');

                        let response = this._tracker.ConfirmResponse.create({
                            response: this._tracker.ConfirmResponse.Result.ACCEPTED,
                            token: daemon.token,
                        });
                        let message = this._tracker.ServerMessage.create({
                            type: this._tracker.ServerMessage.Type.CONFIRM_RESPONSE,
                            confirmResponse: response,
                        });
                        let data = this._tracker.ServerMessage.encode(message).finish();
                        this._tracker.send(id, data);
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'ConfirmRequest.onMessage()'));
            });
    }
}

module.exports = ConfirmRequest;