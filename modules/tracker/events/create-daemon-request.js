/**
 * Create Daemon Request event
 * @module tracker/events/create-daemon-request
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Create Daemon Request event class
 */
class CreateDaemonRequest {
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
     * Service name is 'modules.tracker.events.createDaemonRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.createDaemonRequest';
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

        debug(`Got CREATE DAEMON REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        this._userRepo.findByToken(message.createDaemonRequest.token)
            .then(users => {
                let user = users.length && users[0];
                if (!user || !user.confirmedAt) {
                    let response = this.tracker.CreateDaemonResponse.create({
                        response: this.tracker.CreateDaemonResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.CREATE_DAEMON_RESPONSE,
                        messageId: message.messageId,
                        createDaemonResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    debug(`Sending CREATE DAEMON RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }
                if (message.createDaemonRequest.daemonName.length && !this.tracker.validateName(message.createDaemonRequest.daemonName)) {
                    let response = this.tracker.CreateDaemonResponse.create({
                        response: this.tracker.CreateDaemonResponse.Result.INVALID_NAME,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.CREATE_DAEMON_RESPONSE,
                        messageId: message.messageId,
                        createDaemonResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    debug(`Sending CREATE DAEMON RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                if (!message.createDaemonRequest.daemonName.length) {
                    message.createDaemonRequest.daemonName = this._util.getRandomString(3, { lower: true, upper: false, digits: false });
                    message.createDaemonRequest.randomize = true;
                }

                if (message.createDaemonRequest.randomize) {
                    let length = this._util.getRandomInt(3, 6);
                    message.createDaemonRequest.daemonName += this._util.getRandomString(length, { lower: false, upper: false, digits: true });
                }

                return this._daemonRepo.findByUserAndName(user, message.createDaemonRequest.daemonName)
                    .then(daemons => {
                        if (daemons.length) {
                            let response = this.tracker.CreateDaemonResponse.create({
                                response: this.tracker.CreateDaemonResponse.Result.NAME_EXISTS,
                            });
                            let reply = this.tracker.ServerMessage.create({
                                type: this.tracker.ServerMessage.Type.CREATE_DAEMON_RESPONSE,
                                messageId: message.messageId,
                                createDaemonResponse: response,
                            });
                            let data = this.tracker.ServerMessage.encode(reply).finish();
                            debug(`Sending CREATE DAEMON RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                            return this.tracker.send(id, data);
                        }

                        let daemon = this._daemonRepo.create();
                        daemon.userId = user.id;
                        daemon.name = message.createDaemonRequest.daemonName;
                        daemon.token = this.tracker.generateToken();
                        daemon.createdAt = moment();
                        daemon.blockedAt = null;

                        return this._daemonRepo.save(daemon)
                            .then(daemonId => {
                                if (!daemonId)
                                    throw new Error('Could not create daemon');

                                let response = this.tracker.CreateDaemonResponse.create({
                                    response: this.tracker.CreateDaemonResponse.Result.ACCEPTED,
                                    daemonName: daemon.name,
                                    token: daemon.token,
                                });
                                let reply = this.tracker.ServerMessage.create({
                                    type: this.tracker.ServerMessage.Type.CREATE_DAEMON_RESPONSE,
                                    messageId: message.messageId,
                                    createDaemonResponse: response,
                                });
                                let data = this.tracker.ServerMessage.encode(reply).finish();
                                debug(`Sending CREATE DAEMON RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                this.tracker.send(id, data);
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'CreateDaemonRequest.handle()'));
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

module.exports = CreateDaemonRequest;