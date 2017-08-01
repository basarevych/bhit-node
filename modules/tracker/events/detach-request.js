/**
 * Detach Request event
 * @module tracker/events/detach-request
 */
const moment = require('moment-timezone');
const NError = require('nerror');

/**
 * Detach Request event class
 */
class DetachRequest {
    /**
     * Create service
     * @param {App} app                                         The application
     * @param {object} config                                   Configuration
     * @param {Logger} logger                                   Logger service
     * @param {Registry} registry                               Registry service
     * @param {RegisterDaemonRequest} registerDaemonRequest     RegisterDaemonRequest service
     * @param {UserRepository} userRepo                         User repository
     * @param {DaemonRepository} daemonRepo                     Daemon repository
     * @param {PathRepository} pathRepo                         Path repository
     * @param {ConnectionRepository} connectionRepo             Connection repository
     */
    constructor(app, config, logger, registry, registerDaemonRequest, userRepo, daemonRepo, pathRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._registerDaemonRequest = registerDaemonRequest;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'modules.tracker.events.detachRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.detachRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [
            'app',
            'config',
            'logger',
            'registry',
            'modules.tracker.events.registerDaemonRequest',
            'repositories.user',
            'repositories.daemon',
            'repositories.path',
            'repositories.connection',
        ];
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

        let userEmail, userPath, target = this._registry.validatePath(message.detachRequest.path);
        if (target) {
            userEmail = target.email;
            userPath = target.path;
        }

        this._logger.debug('detach-request', `Got DETACH REQUEST from ${id}`);
        return Promise.resolve()
            .then(() => {
                if (!client.daemonId)
                    return [];

                let info = this._registry.daemons.get(client.daemonId);
                if (!info)
                    return [];

                if (!userEmail)
                    userEmail = info.userEmail;

                return this._daemonRepo.find(client.daemonId);
            })
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon) {
                    let response = this.tracker.DetachResponse.create({
                        response: this.tracker.DetachResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.DETACH_RESPONSE,
                        messageId: message.messageId,
                        detachResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('detach-request', `Sending REJECTED DETACH RESPONSE to ${id}`);
                    return this.tracker.send(id, data);
                }
                if (!target) {
                    let response = this.tracker.DetachResponse.create({
                        response: this.tracker.DetachResponse.Result.INVALID_PATH,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.DETACH_RESPONSE,
                        messageId: message.messageId,
                        detachResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('detach-request', `Sending INVALID_PATH DETACH RESPONSE to ${id}`);
                    return this.tracker.send(id, data);
                }

                return this._userRepo.findByEmail(userEmail)
                    .then(users => {
                        let user = users.length && users[0];

                        return Promise.resolve()
                            .then(() => {
                                if (!user)
                                    return [];

                                return this._pathRepo.findByUserAndPath(user, userPath);
                            })
                            .then(paths => {
                                let path = paths.length && paths[0];
                                if (!path || !user) {
                                    let response = this.tracker.DetachResponse.create({
                                        response: this.tracker.DetachResponse.Result.PATH_NOT_FOUND,
                                    });
                                    let reply = this.tracker.ServerMessage.create({
                                        type: this.tracker.ServerMessage.Type.DETACH_RESPONSE,
                                        messageId: message.messageId,
                                        detachResponse: response,
                                    });
                                    let data = this.tracker.ServerMessage.encode(reply).finish();
                                    this._logger.debug('detach-request', `Sending PATH_NOT_FOUND DETACH RESPONSE to ${id}`);
                                    return this.tracker.send(id, data);
                                }

                                return this._connectionRepo.findByPath(path)
                                    .then(connections => {
                                        let connection = connections.length && connections[0];
                                        if (!connection) {
                                            let response = this.tracker.DetachResponse.create({
                                                response: this.tracker.DetachResponse.Result.PATH_NOT_FOUND,
                                            });
                                            let reply = this.tracker.ServerMessage.create({
                                                type: this.tracker.ServerMessage.Type.DETACH_RESPONSE,
                                                messageId: message.messageId,
                                                detachResponse: response,
                                            });
                                            let data = this.tracker.ServerMessage.encode(reply).finish();
                                            this._logger.debug('detach-request', `Sending PATH_NOT_FOUND DETACH RESPONSE to ${id}`);
                                            return this.tracker.send(id, data);
                                        }

                                        let name = user.email + path.path;

                                        return this.disconnect(daemon, connection)
                                            .then(count => {
                                                let response = this.tracker.DetachResponse.create({
                                                    response: (count > 0 ?
                                                        this.tracker.DetachResponse.Result.ACCEPTED :
                                                        this.tracker.DetachResponse.Result.NOT_CONNECTED),
                                                });
                                                let reply = this.tracker.ServerMessage.create({
                                                    type: this.tracker.ServerMessage.Type.DETACH_RESPONSE,
                                                    messageId: message.messageId,
                                                    detachResponse: response,
                                                });
                                                let data = this.tracker.ServerMessage.encode(reply).finish();
                                                this._logger.debug('detach-request', `Sending SUCCESS DETACH RESPONSE to ${id}`);
                                                this.tracker.send(id, data);

                                                if (!count)
                                                    return;

                                                let info = this._registry.daemons.get(daemon.id);
                                                if (info) {
                                                    let promises = [];
                                                    for (let clientId of info.clients)
                                                        promises.push(this._registerDaemonRequest.sendConnectionsList(clientId));

                                                    if (promises.length)
                                                        return Promise.all(promises);
                                                }
                                            });
                                    });
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new NError(error, 'DetachRequest.handle()'));
            });
    }

    /**
     * Remove daemon from a connection
     * @param {DaemonModel} daemon
     * @param {ConnectionModel} connection
     * @return {Promise}
     */
    disconnect(daemon, connection) {
        return this._daemonRepo.disconnect(daemon, connection)
            .then(count => {
                let info = this._registry.daemons.get(daemon.id);
                if (info && info.clients.size)
                    this._registry.removeConnection(name, Array.from(info.clients));

                return count;
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

module.exports = DetachRequest;