/**
 * Redeem Master Request event
 * @module tracker/events/redeem-master-request
 */
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Redeem Master Request event class
 */
class RedeemMasterRequest {
    /**
     * Create service
     * @param {App} app                         The application
     * @param {object} config                   Configuration
     * @param {Logger} logger                   Logger service
     * @param {Emailer} emailer                 Emailer
     * @param {Util} util                       Util
     * @param {UserRepository} userRepo         User repository
     */
    constructor(app, config, logger, emailer, util, userRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._emailer = emailer;
        this._util = util;
        this._userRepo = userRepo;
    }

    /**
     * Service name is 'modules.tracker.events.redeemMasterRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.redeemMasterRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'emailer', 'util', 'repositories.user' ];
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

        this._logger.debug('redeem-master-request', `Got REDEEM MASTER REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        this._userRepo.findByEmail(message.redeemMasterRequest.email)
            .then(users => {
                let user = users.length && users[0];
                if (!user) {
                    let response = this.tracker.RedeemMasterResponse.create({
                        response: this.tracker.RedeemMasterResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.REDEEM_MASTER_RESPONSE,
                        messageId: message.messageId,
                        redeemMasterResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('redeem-master-request', `Sending REDEEM MASTER RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                user.confirm = this.tracker.generateToken();

                return this._userRepo.save(user)
                    .then(userId => {
                        if (!userId)
                            throw new Error('Could not update user');

                        let emailText = 'Breedhub Interconnect\n\n' +
                            'Someone has requested master token regeneration of ' + user.email + '.\n\n' +
                            'If this was you then please run the following command on the daemon:\n\n' +
                            'bhid confirm ' + user.confirm;

                        return this._emailer.send({
                                to: user.email,
                                from: this._config.get('email.from'),
                                subject: 'Please confirm master token regeneration',
                                text: emailText,
                            })
                            .then(
                                () => {
                                    let response = this.tracker.RedeemMasterResponse.create({
                                        response: this.tracker.RedeemMasterResponse.Result.ACCEPTED,
                                    });
                                    let reply = this.tracker.ServerMessage.create({
                                        type: this.tracker.ServerMessage.Type.REDEEM_MASTER_RESPONSE,
                                        messageId: message.messageId,
                                        redeemMasterResponse: response,
                                    });
                                    let data = this.tracker.ServerMessage.encode(reply).finish();
                                    this._logger.debug('redeem-master-request', `Sending REDEEM MASTER RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                    this.tracker.send(id, data);
                                },
                                error => {
                                    this._logger.error(`Could not send mail: ${error.message}`);
                                }
                            );
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'RedeemMasterRequest.handle()'));
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

module.exports = RedeemMasterRequest;