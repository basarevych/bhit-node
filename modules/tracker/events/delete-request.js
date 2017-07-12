/**
 * Delete Request event
 * @module tracker/events/delete-request
 */
const moment = require('moment-timezone');
const NError = require('nerror');

/**
 * Delete Request event class
 */
class DeleteRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {Registry} registry                       Registry service
     * @param {UserRepository} userRepo                 User repository
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {PathRepository} pathRepo                 Path repository
     */
    constructor(app, config, logger, registry, userRepo, daemonRepo, pathRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
    }

    /**
     * Service name is 'modules.tracker.events.deleteRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.deleteRequest';
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
            'repositories.path',
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

        this._logger.debug('delete-request', `Got DELETE REQUEST from ${id}`);
        this._userRepo.findByToken(message.deleteRequest.token)
            .then(users => {
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

                let path = this._registry.validatePath(message.deleteRequest.path);
                if (!path || path.email) {
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
                path = path.path;

                return this._pathRepo.findByUserAndPath(user.id, path)
                    .then(paths => {
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

                        return this._pathRepo.findByUserAndPathRecursive(user, path.path)
                            .then(paths => {
                                let updatedClients = [];
                                for (let path of paths) {
                                    let clients = this._registry.removeConnection(user.email + path.path);
                                    for (let clientId of clients) {
                                        if (updatedClients.indexOf(clientId) === -1)
                                            updatedClients.push(clientId);
                                    }
                                }

                                return this._pathRepo.deleteRecursive(path)
                                    .then(() => {
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
                                        for (let clientId of updatedClients) {
                                            let client = this._registry.clients.get(clientId);
                                            if (!client || !client.daemonId)
                                                continue;

                                            promises.push(
                                                this._daemonRepo.getConnectionsList(client.daemonId)
                                                    .then(list => {
                                                        if (!list)
                                                            return;

                                                        let prepared = this.tracker.ConnectionsList.create({
                                                            serverConnections: [],
                                                            clientConnections: [],
                                                        });
                                                        for (let item of list.serverConnections)
                                                            prepared.serverConnections.push(this.tracker.ServerConnection.create(item));
                                                        for (let item of list.clientConnections)
                                                            prepared.clientConnections.push(this.tracker.ClientConnection.create(item));

                                                        let reply = this.tracker.ServerMessage.create({
                                                            type: this.tracker.ServerMessage.Type.CONNECTIONS_LIST,
                                                            connectionsList: prepared,
                                                        });
                                                        let data = this.tracker.ServerMessage.encode(reply).finish();
                                                        this._logger.debug('delete-request', `Sending CONNECTIONS LIST to ${clientId}`);
                                                        this.tracker.send(clientId, data);
                                                    })
                                            );
                                        }

                                        if (promises.length)
                                            return Promise.all(promises);
                                    });
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new NError(error, 'DeleteRequest.handle()'));
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

module.exports = DeleteRequest;