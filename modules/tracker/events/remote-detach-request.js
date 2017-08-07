/**
 * Remote Detach Request event
 * @module tracker/events/remote-detach-request
 */
const moment = require('moment-timezone');
const NError = require('nerror');

/**
 * Remote Detach Request event class
 */
class RemoteDetachRequest {
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
        this._app = app;
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
     * Service name is 'modules.tracker.events.remoteDetachRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.remoteDetachRequest';
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
            'modules.tracker.events.detachRequest',
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

        this._logger.debug('remote-detach-request', `Got REMOTE DETACH REQUEST from ${id}`);
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

        this._userRepo.findByToken(message.remoteDetachRequest.token)
            .then(users => {
                let daemonUser = users.length && users[0];
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

                return this._userRepo.findByEmail(userEmail)
                    .then(users => {
                        let connUser = users.length && users[0];
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

                        return this._daemonRepo.findByUserAndName(daemonUser, message.remoteDetachRequest.daemonName)
                            .then(daemons => {
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

                                return this._pathRepo.findByUserAndPath(connUser, userPath)
                                    .then(paths => {
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

                                        return this._connectionRepo.findByPath(path)
                                            .then(() => {
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

                                                return this._detachRequest.disconnect(daemon, connection)
                                                    .then(count => {
                                                        let response = this.tracker.RemoteDetachResponse.create({
                                                            response: (count > 0 ?
                                                                this.tracker.RemoteDetachResponse.Result.ACCEPTED :
                                                                this.tracker.RemoteDetachResponse.Result.NOT_ATTACHED),
                                                        });
                                                        let reply = this.tracker.ServerMessage.create({
                                                            type: this.tracker.ServerMessage.Type.REMOTE_DETACH_RESPONSE,
                                                            messageId: message.messageId,
                                                            remoteDetachResponse: response,
                                                        });
                                                        let data = this.tracker.ServerMessage.encode(reply).finish();
                                                        this._logger.debug('remote-detach-request', `Sending SUCCESS REMOTE DETACH RESPONSE to ${id}`);
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
                    });
            })
            .catch(error => {
                this._logger.error(new NError(error, 'RemoteDetachRequest.handle()'));
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

module.exports = RemoteDetachRequest;