/**
 * Register Daemon Request event
 * @module tracker/events/register-daemon-request
 */
const moment = require('moment-timezone');
const NError = require('nerror');

/**
 * Register Daemon Request event class
 */
class RegisterDaemonRequest {
    /**
     * Create service
     * @param {App} app                         The application
     * @param {object} config                   Configuration
     * @param {Logger} logger                   Logger service
     * @param {Registry} registry               Registry service
     * @param {UserRepository} userRepo         User repository
     * @param {DaemonRepository} daemonRepo     Daemon repository
     */
    constructor(app, config, logger, registry, userRepo, daemonRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
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
        return [ 'app', 'config', 'logger', 'registry', 'repositories.user', 'repositories.daemon' ];
    }

    /**
     * Event handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    handle(id, message) {
        let client = this._registry.clients.get(id);
        if (!client)
            return;

        this._logger.debug('register-daemon-request', `Got REGISTER DAEMON REQUEST from ${id}`);
        return this._daemonRepo.findByToken(message.registerDaemonRequest.token)
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (daemon) {
                    let identity = this._registry.identities.get(message.registerDaemonRequest.identity);
                    if (identity && identity.clients.size) {
                        let iter = identity.clients.values();
                        let found = iter.next().value;
                        let info = this._registry.clients.get(found);
                        if (info && info.daemonId !== daemon.id)
                            daemon = null;
                    }
                }

                return Promise.resolve()
                    .then(() => {
                        if (!daemon)
                            return [];

                        return this._userRepo.find(daemon.userId);
                    })
                    .then(users => {
                        let success, user = users.length && users[0];
                        if (!daemon || !user) {
                            success = false;
                        } else {
                            success = this._registry.registerDaemon(id, daemon.id, daemon.name,
                                message.registerDaemonRequest.identity, message.registerDaemonRequest.key,
                                user.id, user.email
                            );
                        }

                        if (!success) {
                            let response = this.tracker.RegisterDaemonResponse.create({
                                response: this.tracker.RegisterDaemonResponse.Result.REJECTED,
                            });
                            let reply = this.tracker.ServerMessage.create({
                                type: this.tracker.ServerMessage.Type.REGISTER_DAEMON_RESPONSE,
                                messageId: message.messageId,
                                registerDaemonResponse: response,
                            });
                            let data = this.tracker.ServerMessage.encode(reply).finish();
                            this._logger.debug('register-daemon-request',`Sending REJECTED REGISTER DAEMON RESPONSE to ${id}`);
                            return this.tracker.send(id, data);
                        }

                        let response = this.tracker.RegisterDaemonResponse.create({
                            response: this.tracker.RegisterDaemonResponse.Result.ACCEPTED,
                            email: user.email,
                            name: daemon.name,
                        });
                        let reply = this.tracker.ServerMessage.create({
                            type: this.tracker.ServerMessage.Type.REGISTER_DAEMON_RESPONSE,
                            messageId: message.messageId,
                            registerDaemonResponse: response,
                        });
                        let data = this.tracker.ServerMessage.encode(reply).finish();
                        this._logger.debug('register-daemon-request', `Sending ACCEPTED REGISTER DAEMON RESPONSE to ${id}`);
                        this.tracker.send(id, data);

                        this.tracker.emit('registration', id);
                    });
            })
            .catch(error => {
                this._logger.error(new NError(error, 'RegisterDaemonRequest.handle()'));
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