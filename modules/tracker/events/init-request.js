/**
 * Init Request event
 * @module tracker/events/init-request
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Init Request event class
 */
class InitRequest {
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
     * Service name is 'modules.tracker.events.initRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.initRequest';
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

        debug(`Got INIT REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        this._userRepo.findByEmail(message.initRequest.email)
            .then(users => {
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
                    debug(`Sending INIT RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                let user = this._userRepo.create();
                user.name = null;
                user.email = message.initRequest.email;
                user.token = this.tracker.generateToken();
                user.confirm = this.tracker.generateToken();
                user.password = this._util.encryptPassword(this._util.generatePassword());
                user.createdAt = moment();
                user.confirmedAt = null;
                user.blockedAt = null;

                return this._userRepo.save(user)
                    .then(userId => {
                        if (!userId)
                            throw new Error('Could not create user');

                        return user;
                    });
            })
            .then(user => {
                let emailText = 'Breedhub Interconnect\n\n' +
                    'Someone has requested account creation on behalf of ' + user.email + '.\n\n' +
                    'If this was you then please run the following command on the daemon:\n\n' +
                    'bhid confirm ' + user.confirm;

                return this._emailer.send({
                        to: user.email,
                        from: this._config.get('email.from'),
                        subject: 'Please confirm account creation',
                        text: emailText,
                    })
                    .then(() => {
                        let response = this.tracker.InitResponse.create({
                            response: this.tracker.InitResponse.Result.ACCEPTED,
                        });
                        let reply = this.tracker.ServerMessage.create({
                            type: this.tracker.ServerMessage.Type.INIT_RESPONSE,
                            messageId: message.messageId,
                            initResponse: response,
                        });
                        let data = this.tracker.ServerMessage.encode(reply).finish();
                        debug(`Sending INIT RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                        this.tracker.send(id, data);
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'InitRequest.handle()'));
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

module.exports = InitRequest;