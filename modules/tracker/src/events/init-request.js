/**
 * Init Request event
 * @module tracker/events/init-request
 */
const moment = require('moment-timezone');
const NError = require('nerror');
const Base = require('./base');

/**
 * Init Request event class
 */
class InitRequest extends Base {
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
        super(app);
        this._config = config;
        this._logger = logger;
        this._emailer = emailer;
        this._util = util;
        this._registry = registry;
        this._userRepo = userRepo;
    }

    /**
     * Service name is 'tracker.events.initRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.initRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'emailer', 'util', 'registry', 'repositories.user' ];
    }

    /**
     * Event name
     * @type {string}
     */
    get name() {
        return 'init_request';
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

        this._logger.debug('init-request', `Got INIT REQUEST from ${id}`);
        try {
            if (!this._registry.validateEmail(message.initRequest.email)) {
                let response = this.tracker.InitResponse.create({
                    response: this.tracker.InitResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.INIT_RESPONSE,
                    messageId: message.messageId,
                    initResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('init-request', `Sending REJECTED INIT RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let users = await this._userRepo.findByEmail(message.initRequest.email);
            if (users.length) {
                let response = this.tracker.InitResponse.create({
                    response: this.tracker.InitResponse.Result.EMAIL_EXISTS,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.INIT_RESPONSE,
                    messageId: message.messageId,
                    initResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('init-request', `Sending EMAIL_EXISTS INIT RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let user = this._userRepo.getModel();
            user.name = null;
            user.email = message.initRequest.email;
            user.token = this._userRepo.generateToken();
            user.confirm = this._userRepo.generateToken();
            user.password = this._util.encryptPassword(this._util.generatePassword());
            user.createdAt = moment();
            user.confirmedAt = null;
            user.blockedAt = null;
            await this._userRepo.save(user);

            let emailText = 'Breedhub Interconnect\n\n' +
                'Someone has requested account creation on behalf of ' + user.email + '.\n\n' +
                'If this was you then please run the following command on the daemon:\n\n' +
                'bhid confirm ' + user.confirm;

            try {
                await this._emailer.send({
                    to: user.email,
                    from: this._config.get('email.from'),
                    subject: 'Interconnect account creation',
                    text: emailText,
                });
            } catch (error) {
                this._logger.error(`Could not send mail: ${error.messages || error.message}`);
            }

            let response = this.tracker.InitResponse.create({
                response: this.tracker.InitResponse.Result.ACCEPTED,
            });
            let reply = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.INIT_RESPONSE,
                messageId: message.messageId,
                initResponse: response,
            });
            let data = this.tracker.ServerMessage.encode(reply).finish();
            this._logger.debug('init-request', `Sending ACCEPTED INIT RESPONSE to ${id}`);
            this.tracker.send(id, data);
        } catch (error) {
            this._logger.error(new NError(error, 'InitRequest.handle()'));
        }
    }
}

module.exports = InitRequest;
