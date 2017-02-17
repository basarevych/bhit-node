/**
 * Register Daemon Request event
 * @module tracker/events/register-daemon-request
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Register Daemon Request event class
 */
class RegisterDaemonRequest {
    /**
     * Create service
     * @param {App} app                         The application
     * @param {object} config                   Configuration
     * @param {Logger} logger                   Logger service
     * @param {UserRepository} userRepo         User repository
     * @param {DaemonRepository} daemonRepo     Daemon repository
     */
    constructor(app, config, logger, userRepo, daemonRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
    }

    /**
     * Service name is 'modules.tracker.events.registerDaemonRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.registerDaemonRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'repositories.user', 'repositories.daemon' ];
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

        debug(`Got REGISTER DAEMON REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        return this._daemonRepo.findByToken(message.registerDaemonRequest.token)
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon) {
                    let response = this.tracker.RegisterDaemonResponse.create({
                        response: this.tracker.RegisterDaemonResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.REGISTER_DAEMON_RESPONSE,
                        messageId: message.messageId,
                        registerDaemonResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    debug(`Sending REGISTER DAEMON RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                client.daemonId = daemon.id;
                client.daemonName = daemon.name;
                client.identity = message.registerDaemonRequest.identity;
                client.key = message.registerDaemonRequest.key;

                let info = this.tracker.identities.get(client.identity);
                if (!info) {
                    info = {
                        clients: new Set(),
                    };
                    this.tracker.identities.set(client.identity, info);
                }
                info.clients.add(client.id);

                info = this.tracker.daemons.get(daemon.id);
                if (!info) {
                    info = {
                        clients: new Set(),
                    };
                    this.tracker.daemons.set(daemon.id, info);
                }
                info.clients.add(client.id);
                this.tracker.emit('registration', id);

                let response = this.tracker.RegisterDaemonResponse.create({
                    response: this.tracker.RegisterDaemonResponse.Result.ACCEPTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this._tracker.ServerMessage.Type.REGISTER_DAEMON_RESPONSE,
                    messageId: message.messageId,
                    registerDaemonResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                debug(`Sending REGISTER DAEMON RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                this.tracker.send(id, data);
            })
            .catch(error => {
                this._logger.error(new WError(error, 'RegisterDaemonRequest.handle()'));
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

module.exports = RegisterDaemonRequest;