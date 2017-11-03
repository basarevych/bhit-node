/**
 * Redeem Master Request event
 * @module tracker/events/redeem-master-request
 */
const NError = require('nerror');

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
     * @param {Registry} registry               Registry
     * @param {UserRepository} userRepo         User repository
     */
    constructor(app, config, logger, emailer, util, registry, userRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._emailer = emailer;
        this._util = util;
        this._registry = registry;
        this._userRepo = userRepo;
    }

    /**
     * Service name is 'tracker.events.redeemMasterRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.redeemMasterRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'emailer', 'util', 'registry', 'repositories.user' ];
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

        this._logger.debug('redeem-master-request', `Got REDEEM MASTER REQUEST from ${id}`);
        try {
            let users = await this._userRepo.findByEmail(message.redeemMasterRequest.email);
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
                this._logger.debug('redeem-master-request', `Sending REJECTED REDEEM MASTER RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            user.confirm = this._userRepo.generateToken();
            await this._userRepo.save(user);

            let emailText = 'Breedhub Interconnect\n\n' +
                'Someone has requested master token regeneration of ' + user.email + '.\n\n' +
                'If this was you then please run the following command on the daemon:\n\n' +
                'bhid confirm ' + user.confirm;

            try {
                await this._emailer.send({
                    to: user.email,
                    from: this._config.get('email.from'),
                    subject: 'Interconnect master token regeneration',
                    text: emailText,
                });
            } catch (error) {
                this._logger.error(`Could not send mail: ${error.messages || error.message}`);
            }

            let response = this.tracker.RedeemMasterResponse.create({
                response: this.tracker.RedeemMasterResponse.Result.ACCEPTED,
            });
            let reply = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.REDEEM_MASTER_RESPONSE,
                messageId: message.messageId,
                redeemMasterResponse: response,
            });
            let data = this.tracker.ServerMessage.encode(reply).finish();
            this._logger.debug('redeem-master-request', `Sending ACCEPTED REDEEM MASTER RESPONSE to ${id}`);
            this.tracker.send(id, data);
        } catch (error) {
            this._logger.error(new NError(error, 'RedeemMasterRequest.handle()'));
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

module.exports = RedeemMasterRequest;
