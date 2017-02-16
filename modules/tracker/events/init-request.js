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
     * @param {Emailer} emailer                 Emailer
     * @param {Util} util                       Util
     * @param {UserRepository} userRepo         User repository
     * @param {DaemonRepository} daemonRepo     Daemon repository
     */
    constructor(app, config, emailer, util, userRepo, daemonRepo) {
        this._app = app;
        this._config = config;
        this._emailer = emailer;
        this._util = util;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
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
        return [ 'app', 'config', 'emailer', 'util', 'repositories.user', 'repositories.daemon' ];
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
                if (users.length)
                    return users[0];

                let user = this._userRepo.create();
                user.name = null;
                user.email = message.initRequest.email;
                user.password = this._util.encryptPassword(this._util.generatePassword());
                user.createdAt = moment();
                user.blockedAt = null;

                return this._userRepo.save(user)
                    .then(userId => {
                        if (!userId)
                            throw new Error('Could not create user');

                        return user;
                    });
            })
            .then(user => {
                return this._daemonRepo.findByUserAndName(user, message.initRequest.daemonName)
                    .then(daemons => {
                        if (daemons.length) {
                            let daemon = daemons[0];
                            daemon.confirm = this.tracker.generateToken();

                            return this._daemonRepo.save(daemon)
                                .then(daemonId => {
                                    if (!daemonId)
                                        throw new Error('Could not save daemon');

                                    let emailText = 'Breedhub Interconnect\n\n' +
                                        'Someone has requested a new token for daemon ' +
                                        message.initRequest.daemonName + ' of ' + user.email + '.\n\n' +
                                        'If this was you then please run the following command on this daemon:\n\n' +
                                        'bhid confirm ' + daemon.confirm;

                                    return this._emailer.send({
                                            to: user.email,
                                            from: this._config.get('email.from'),
                                            subject: 'Please confirm new token',
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
                                });
                        }

                        let daemon = this._daemonRepo.create();
                        daemon.userId = user.id;
                        daemon.name = message.initRequest.daemonName;
                        daemon.token = this.tracker.generateToken();
                        daemon.confirm = this.tracker.generateToken();
                        daemon.createdAt = moment();
                        daemon.confirmedAt = null;
                        daemon.blockedAt = null;

                        return this._daemonRepo.save(daemon)
                            .then(daemonId => {
                                if (!daemonId)
                                    throw new Error('Could not create daemon');

                                let emailText = 'Breedhub Interconnect\n\n' +
                                    'Someone has requested creation of a new daemon named ' +
                                    message.initRequest.daemonName + ' of ' +
                                    user.email + '.\n\n' +
                                    'If this was you then please run the following command on this daemon:\n\n' +
                                    'bhid confirm ' + daemon.confirm;

                                return this._emailer.send({
                                        to: user.email,
                                        from: this._config.get('email.from'),
                                        subject: 'Please confirm new daemon',
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
                            });
                    });
            })
            .catch(error => {
                this.tracker._logger.error(new WError(error, 'InitRequest.handle()'));
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