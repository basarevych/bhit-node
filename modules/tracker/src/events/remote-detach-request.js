/**
 * Remote Detach Request event
 * @module tracker/events/remote-detach-request
 */
const NError = require('nerror');
const Base = require('./base');

/**
 * Remote Detach Request event class
 */
class RemoteDetachRequest extends Base {
    /**
     * Create service
     * @param {App} app                                         The application
     * @param {object} config                                   Configuration
     * @param {Logger} logger                                   Logger service
     * @param {Registry} registry                               Registry service
     * @param {RegisterDaemonRequest} registerDaemonRequest     RegisterDaemonRequest service
     * @param {DetachRequest} detachRequest                     DetachRequest service
     * @param {UserRepository} userRepo                         User repository
     * @param {DaemonRepository} daemonRepo                     Daemon repository
     * @param {PathRepository} pathRepo                         Path repository
     * @param {ConnectionRepository} connectionRepo             Connection repository
     */
    constructor(app, config, logger, registry, registerDaemonRequest, detachRequest, userRepo, daemonRepo, pathRepo, connectionRepo) {
        super(app);
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._registerDaemonRequest = registerDaemonRequest;
        this._detachRequest = detachRequest;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'tracker.events.remoteDetachRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.remoteDetachRequest';
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
            'tracker.events.registerDaemonRequest',
            'tracker.events.detachRequest',
            'repositories.user',
            'repositories.daemon',
            'repositories.path',
            'repositories.connection',
        ];
    }

    /**
     * Event name
     * @type {string}
     */
    get name() {
        return 'remote_detach_request';
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

        this._logger.debug('remote-detach-request', `Got REMOTE DETACH REQUEST from ${id}`);
        try {
            let target = this._registry.validatePath(message.remoteDetachRequest.path);
            if (!target) {
                let response = this.tracker.RemoteDetachResponse.create({
                    response: this.tracker.RemoteDetachResponse.Result.INVALID_PATH,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.REMOTE_DETACH_RESPONSE,
                    messageId: message.messageId,
                    remoteDetachResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('remote-detach-request', `Sending INVALID_PATH REMOTE DETACH RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let { email: userEmail, path: userPath } = target;

            let daemonUsers = await this._userRepo.findByToken(message.remoteDetachRequest.token);
            let daemonUser = daemonUsers.length && daemonUsers[0];
            if (!daemonUser) {
                let response = this.tracker.RemoteDetachResponse.create({
                    response: this.tracker.RemoteDetachResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.REMOTE_DETACH_RESPONSE,
                    messageId: message.messageId,
                    remoteDetachResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('remote-detach-request', `Sending REJECTED REMOTE DETACH RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }
            if (!userEmail)
                userEmail = daemonUser.email;

            let connUsers = await this._userRepo.findByEmail(userEmail);
            let connUser = connUsers.length && connUsers[0];
            if (!connUser) {
                let response = this.tracker.RemoteDetachResponse.create({
                    response: this.tracker.RemoteDetachResponse.Result.PATH_NOT_FOUND,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.REMOTE_DETACH_RESPONSE,
                    messageId: message.messageId,
                    remoteDetachResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('remote-detach-request', `Sending PATH_NOT_FOUND REMOTE DETACH RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let daemons = await this._daemonRepo.findByUserAndName(daemonUser, message.remoteDetachRequest.daemonName);
            let daemon = daemons.length && daemons[0];
            if (!daemon) {
                let response = this.tracker.RemoteDetachResponse.create({
                    response: this.tracker.RemoteDetachResponse.Result.DAEMON_NOT_FOUND,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.REMOTE_DETACH_RESPONSE,
                    messageId: message.messageId,
                    remoteDetachResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('remote-detach-request', `Sending DAEMON_NOT_FOUND REMOTE DETACH RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let paths = await this._pathRepo.findByUserAndPath(connUser, userPath);
            let path = paths.length && paths[0];
            if (!path) {
                let response = this.tracker.RemoteDetachResponse.create({
                    response: this.tracker.RemoteDetachResponse.Result.PATH_NOT_FOUND,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.REMOTE_DETACH_RESPONSE,
                    messageId: message.messageId,
                    remoteDetachResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('remote-detach-request', `Sending PATH_NOT_FOUND REMOTE DETACH RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let connections = await this._connectionRepo.findByPath(path);
            let connection = connections.length && connections[0];
            if (!connection) {
                let response = this.tracker.RemoteDetachResponse.create({
                    response: this.tracker.RemoteDetachResponse.Result.PATH_NOT_FOUND,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.REMOTE_DETACH_RESPONSE,
                    messageId: message.messageId,
                    remoteDetachResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('remote-detach-request', `Sending PATH_NOT_FOUND REMOTE DETACH RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let count = await this._detachRequest.disconnect(daemon, connection);

            let response = this.tracker.RemoteDetachResponse.create({
                response: (count > 0
                    ? this.tracker.RemoteDetachResponse.Result.ACCEPTED
                    : this.tracker.RemoteDetachResponse.Result.NOT_ATTACHED),
            });
            let reply = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.REMOTE_DETACH_RESPONSE,
                messageId: message.messageId,
                remoteDetachResponse: response,
            });
            let data = this.tracker.ServerMessage.encode(reply).finish();
            this._logger.debug('remote-detach-request', `Sending SUCCESS REMOTE DETACH RESPONSE to ${id}`);
            this.tracker.send(id, data);

            if (count) {
                let info = this._registry.daemons.get(daemon.id);
                if (info) {
                    let promises = [];
                    for (let clientId of info.clients)
                        promises.push(this._registerDaemonRequest.sendConnectionsList(clientId));
                    await Promise.all(promises);
                }
            }
        } catch (error) {
            this._logger.error(new NError(error, 'RemoteDetachRequest.handle()'));
        }
    }
}

module.exports = RemoteDetachRequest;
