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
                    if (identity) {
                        for (let clientId of identity.clients) {
                            let info = this._registry.clients.get(clientId);
                            if (!info) {
                                identity.clients.delete(clientId);
                                continue;
                            }
                            if (info.daemonId !== daemon.id) {
                                daemon = null;
                                break;
                            }
                            if (info.identity !== message.registerDaemonRequest.identity) {
                                daemon = null;
                                break;
                            }
                            if (info.key !== message.registerDaemonRequest.key) {
                                daemon = null;
                                break;
                            }
                        }
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
                            if (client.daemonId && client.daemonId !== daemon.id)
                                this._registry.removeClient(id);

                            success = this._registry.registerDaemon({
                                clientId: id,
                                daemonId: daemon.id,
                                daemonName: daemon.name,
                                identity: message.registerDaemonRequest.identity,
                                key: message.registerDaemonRequest.key,
                                hostname: message.registerDaemonRequest.hostname,
                                version: message.registerDaemonRequest.version,
                                userId: user.id,
                                userEmail: user.email,
                            });
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

                        return this.sendConnectionsList(id);
                    });
            })
            .catch(error => {
                this._logger.error(new NError(error, 'RegisterDaemonRequest.handle()'));
            });
    }

    /**
     * Send connections list to a client
     * @param {string} clientId
     * @param {boolean} [sendEmptyList=false]
     * @return {Promise}
     */
    sendConnectionsList(clientId, sendEmptyList = false) {
        let client = this._registry.clients.get(clientId);
        if (!client || !client.daemonId)
            return Promise.resolve();

        return Promise.resolve()
            .then(() => {
                if (sendEmptyList)
                    return null;

                return this._daemonRepo.getConnectionsList(client.daemonId);
            })
            .then(list => {
                let prepared = this.tracker.ConnectionsList.create({
                    serverConnections: [],
                    clientConnections: [],
                });

                if (list) {
                    for (let item of list.serverConnections)
                        prepared.serverConnections.push(this.tracker.ServerConnection.create(item));
                    for (let item of list.clientConnections)
                        prepared.clientConnections.push(this.tracker.ClientConnection.create(item));
                }

                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.CONNECTIONS_LIST,
                    connectionsList: prepared,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('status', `Sending CONNECTIONS LIST to ${clientId}`);
                this.tracker.send(clientId, data);
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