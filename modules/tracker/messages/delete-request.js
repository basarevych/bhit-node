/**
 * Delete Request message
 * @module tracker/messages/delete-request
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Delete Request message class
 */
class DeleteRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {PathRepository} pathRepo                 Path repository
     */
    constructor(app, config, daemonRepo, pathRepo) {
        this._app = app;
        this._config = config;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
    }

    /**
     * Service name is 'modules.tracker.messages.deleteRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.messages.deleteRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'repositories.daemon', 'repositories.path' ];
    }

    /**
     * Message handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    onMessage(id, message) {
        let client = this.tracker.clients.get(id);
        if (!client)
            return;

        debug(`Got DELETE REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        return this._daemonRepo.findByToken(message.deleteRequest.token)
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon) {
                    let response = this.tracker.DeleteResponse.create({
                        response: this.tracker.DeleteResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.DELETE_RESPONSE,
                        messageId: message.messageId,
                        deleteResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    debug(`Sending DELETE RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }
                if (!this.tracker.validatePath(message.deleteRequest.path)) {
                    let response = this.tracker.DeleteResponse.create({
                        response: this.tracker.DeleteResponse.Result.INVALID_PATH,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.DELETE_RESPONSE,
                        messageId: message.messageId,
                        deleteResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    debug(`Sending DELETE RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                return this._pathRepo.findByUserAndPath(daemon.userId, message.deleteRequest.path)
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
                            debug(`Sending DELETE RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                            return this.tracker.send(id, data);
                        }

                        return this._pathRepo.deleteRecursive(path)
                            .then(() => {
                                let response = this.tracker.DeleteResponse.create({
                                    response: this.tracker.DeleteResponse.Result.ACCEPTED,
                                });
                                let reply = this.tracker.ServerMessage.create({
                                    type: this._tracker.ServerMessage.Type.DELETE_RESPONSE,
                                    messageId: message.messageId,
                                    deleteResponse: response,
                                });
                                let data = this.tracker.ServerMessage.encode(reply).finish();
                                debug(`Sending DELETE RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                this._tracker.send(id, data);
                            });
                    });
            })
            .catch(error => {
                this._tracker._logger.error(new WError(error, 'DeleteRequest.onMessage()'));
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