/**
 * Delete Daemon Request event
 * @module tracker/events/delete-daemon-request
 */
const NError = require('nerror');
const Base = require('./base');

/**
 * Delete Daemon Request event class
 */
class DeleteDaemonRequest extends Base {
    /**
     * Create service
     * @param {App} app                                         The application
     * @param {object} config                                   Configuration
     * @param {Logger} logger                                   Logger service
     * @param {Registry} registry                               Registry service
     * @param {UserRepository} userRepo                         User repository
     * @param {DaemonRepository} daemonRepo                     Daemon repository
     * @param {RegisterDaemonRequest} registerDaemonRequest     RegisterDaemonRequest event
     */
    constructor(app, config, logger, registry, userRepo, daemonRepo, registerDaemonRequest) {
        super(app);
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._registerDaemonRequest = registerDaemonRequest;
    }

    /**
     * Service name is 'tracker.events.deleteDaemonRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.deleteDaemonRequest';
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
            'repositories.user',
            'repositories.daemon',
            'tracker.events.registerDaemonRequest'
        ];
    }

    /**
     * Event name
     * @type {string}
     */
    get name() {
        return 'delete_daemon_request';
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

        this._logger.debug('delete-daemon-request', `Got DELETE DAEMON REQUEST from ${id}`);
        try {
            let users = await this._userRepo.findByToken(message.deleteDaemonRequest.token);
            let user = users.length && users[0];
            if (!user || !user.confirmedAt) {
                let response = this.tracker.DeleteDaemonResponse.create({
                    response: this.tracker.DeleteDaemonResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.DELETE_DAEMON_RESPONSE,
                    messageId: message.messageId,
                    deleteDaemonResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('delete-daemon-request', `Sending REJECTED DELETE DAEMON RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let daemons = await this._daemonRepo.findByUserAndName(user, message.deleteDaemonRequest.daemonName);
            let daemon = daemons.length && daemons[0];
            if (!daemon) {
                let response = this.tracker.DeleteDaemonResponse.create({
                    response: this.tracker.DeleteDaemonResponse.Result.NOT_FOUND,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.DELETE_DAEMON_RESPONSE,
                    messageId: message.messageId,
                    deleteDaemonResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('delete-daemon-request', `Sending NOT_FOUND DELETE DAEMON RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let info = this._registry.daemons.get(daemon.id);
            let clients = info ? Array.from(info.clients) : [];

            this._registry.removeDaemon(daemon.id);
            await this._daemonRepo.delete(daemon);

            let promises = [];
            for (let clientId of clients)
                promises.push(this._registerDaemonRequest.sendConnectionsList(clientId, true));
            await Promise.all(promises);

            for (let clientId of clients) {
                let info = this.tracker.clients.get(clientId);
                if (info) {
                    info.socket.end();
                    info.wrapper.detach();
                }
            }

            let response = this.tracker.DeleteDaemonResponse.create({
                response: this.tracker.DeleteDaemonResponse.Result.ACCEPTED,
            });
            let reply = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.DELETE_DAEMON_RESPONSE,
                messageId: message.messageId,
                deleteDaemonResponse: response,
            });
            let data = this.tracker.ServerMessage.encode(reply).finish();
            this._logger.debug('delete-daemon-request', `Sending ACCEPTED DELETE DAEMON RESPONSE to ${id}`);
            this.tracker.send(id, data);
        } catch (error) {
            this._logger.error(new NError(error, 'DeleteDaemonRequest.handle()'));
        }
    }
}

module.exports = DeleteDaemonRequest;
