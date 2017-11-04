/**
 * Delete Request event
 * @module tracker/events/delete-request
 */
const NError = require('nerror');
const Base = require('./base');

/**
 * Delete Request event class
 */
class DeleteRequest extends Base {
    /**
     * Create service
     * @param {App} app                                         The application
     * @param {object} config                                   Configuration
     * @param {Logger} logger                                   Logger service
     * @param {Registry} registry                               Registry service
     * @param {RegisterDaemonRequest} registerDaemonRequest     RegisterDaemonRequest event
     * @param {UserRepository} userRepo                         User repository
     * @param {DaemonRepository} daemonRepo                     Daemon repository
     * @param {PathRepository} pathRepo                         Path repository
     */
    constructor(app, config, logger, registry, registerDaemonRequest, userRepo, daemonRepo, pathRepo) {
        super(app);
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._registerDaemonRequest = registerDaemonRequest;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
    }

    /**
     * Service name is 'tracker.events.deleteRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.deleteRequest';
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
            'repositories.user',
            'repositories.daemon',
            'repositories.path',
        ];
    }

    /**
     * Event name
     * @type {string}
     */
    get name() {
        return 'delete_request';
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

        this._logger.debug('delete-request', `Got DELETE REQUEST from ${id}`);
        try {
            let users = await this._userRepo.findByToken(message.deleteRequest.token);
            let user = users.length && users[0];
            if (!user) {
                let response = this.tracker.DeleteResponse.create({
                    response: this.tracker.DeleteResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.DELETE_RESPONSE,
                    messageId: message.messageId,
                    deleteResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('redeem-path-request', `Sending REJECTED DELETE RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let fullPath = this._registry.validatePath(message.deleteRequest.path);
            if (!fullPath || fullPath.email) {
                let response = this.tracker.DeleteResponse.create({
                    response: this.tracker.DeleteResponse.Result.INVALID_PATH,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.DELETE_RESPONSE,
                    messageId: message.messageId,
                    deleteResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('delete-request', `Sending INVALID_PATH DELETE RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }
            fullPath = fullPath.path;

            let paths = await this._pathRepo.findByUserAndPath(user.id, fullPath);
            let path = paths.length && paths[0];
            if (!path) {
                let response = this.tracker.DeleteResponse.create({
                    response: this.tracker.DeleteResponse.Result.PATH_NOT_FOUND,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.DELETE_RESPONSE,
                    messageId: message.messageId,
                    deleteResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('delete-request', `Sending PATH_NOT_FOUND DELETE RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let updatedClients = [];
            for (let item of await this._pathRepo.findByUserAndPathRecursive(user, path.path)) {
                let clients = this._registry.removeConnection(user.email + item.path);
                for (let clientId of clients) {
                    if (updatedClients.indexOf(clientId) === -1)
                        updatedClients.push(clientId);
                }
            }

            await this._pathRepo.deleteRecursive(path);

            let response = this.tracker.DeleteResponse.create({
                response: this.tracker.DeleteResponse.Result.ACCEPTED,
            });
            let reply = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.DELETE_RESPONSE,
                messageId: message.messageId,
                deleteResponse: response,
            });
            let data = this.tracker.ServerMessage.encode(reply).finish();
            this._logger.debug('delete-request', `Sending ACCEPTED DELETE RESPONSE to ${id}`);
            this.tracker.send(id, data);

            let promises = [];
            for (let clientId of updatedClients)
                promises.push(this._registerDaemonRequest.sendConnectionsList(clientId));
            await Promise.all(promises);
        } catch (error) {
            this._logger.error(new NError(error, 'DeleteRequest.handle()'));
        }
    }
}

module.exports = DeleteRequest;
