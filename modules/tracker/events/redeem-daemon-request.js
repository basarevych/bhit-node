/**
 * Redeem Daemon Request event
 * @module tracker/events/redeem-daemon-request
 */
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Redeem Daemon Request event class
 */
class RedeemDaemonRequest {
    /**
     * Create service
     * @param {App} app                         The application
     * @param {object} config                   Configuration
     * @param {Logger} logger                   Logger service
     * @param {Util} util                       Util
     * @param {UserRepository} userRepo         User repository
     * @param {DaemonRepository} daemonRepo     Daemon repository
     */
    constructor(app, config, logger, util, userRepo, daemonRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._util = util;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
    }

    /**
     * Service name is 'modules.tracker.events.redeemDaemonRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.redeemDaemonRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'util', 'repositories.user', 'repositories.daemon' ];
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

        this._logger.debug('redeem-daemon-request', `Got REDEEM DAEMON REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        this._userRepo.findByToken(message.redeemDaemonRequest.token)
            .then(users => {
                let user = users.length && users[0];
                if (!user) {
                    let response = this.tracker.RedeemDaemonResponse.create({
                        response: this.tracker.RedeemDaemonResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.REDEEM_DAEMON_RESPONSE,
                        messageId: message.messageId,
                        redeemDaemonResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('redeem-daemon-request', `Sending REDEEM DAEMON RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                return this._daemonRepo.findByUserAndName(user, message.redeemDaemonRequest.daemonName)
                    .then(daemons => {
                        let daemon = daemons.length && daemons[0];
                        if (!daemon) {
                            let response = this.tracker.RedeemDaemonResponse.create({
                                response: this.tracker.RedeemDaemonResponse.Result.REJECTED,
                            });
                            let reply = this.tracker.ServerMessage.create({
                                type: this.tracker.ServerMessage.Type.REDEEM_DAEMON_RESPONSE,
                                messageId: message.messageId,
                                redeemDaemonResponse: response,
                            });
                            let data = this.tracker.ServerMessage.encode(reply).finish();
                            this._logger.debug('redeem-daemon-request', `Sending REDEEM DAEMON RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                            return this.tracker.send(id, data);
                        }

                        daemon.token = this.tracker.generateToken();

                        return this._daemonRepo.save(daemon)
                            .then(daemonId => {
                                if (!daemonId)
                                    throw new Error('Could not update daemon');

                                let response = this.tracker.RedeemDaemonResponse.create({
                                    response: this.tracker.RedeemDaemonResponse.Result.ACCEPTED,
                                    token: daemon.token,
                                });
                                let reply = this.tracker.ServerMessage.create({
                                    type: this.tracker.ServerMessage.Type.REDEEM_DAEMON_RESPONSE,
                                    messageId: message.messageId,
                                    redeemDaemonResponse: response,
                                });
                                let data = this.tracker.ServerMessage.encode(reply).finish();
                                this._logger.debug('redeem-daemon-request', `Sending REDEEM DAEMON RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                this.tracker.send(id, data);
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'RedeemDaemonRequest.handle()'));
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

module.exports = RedeemDaemonRequest;