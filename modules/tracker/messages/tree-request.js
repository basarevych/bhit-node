/**
 * Tree Request message
 * @module tracker/messages/tree
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Tree Request message class
 */
class TreeRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {PathRepository} pathRepo                 Path repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, daemonRepo, pathRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'modules.tracker.messages.treeRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.messages.treeRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'repositories.daemon', 'repositories.path', 'repositories.connection' ];
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

        debug(`Got TREE REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        return this._daemonRepo.findByToken(message.treeRequest.token)
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon) {
                    let response = this.tracker.TreeResponse.create({
                        response: this.tracker.TreeResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.TREE_RESPONSE,
                        messageId: message.messageId,
                        treeResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    debug(`Sending TREE RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }
                if (message.treeRequest.path.length && !this.tracker.validatePath(message.treeRequest.path)) {
                    let response = this.tracker.TreeResponse.create({
                        response: this.tracker.TreeResponse.Result.INVALID_PATH,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.TREE_RESPONSE,
                        messageId: message.messageId,
                        treeResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    debug(`Sending TREE RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                    return this.tracker.send(id, data);
                }

                let treeRoots = [];
                let loadTree = (tree, path) => {
                    let nodes = [];
                    let isConnection, type;
                    return this._connectionRepo.findByPath(path)
                        .then(connections => {
                            let connection = connections.length && connections[0];

                            return Promise.resolve()
                                .then(() => {
                                    if (!connection) {
                                        isConnection = false;
                                        type = this.tracker.Tree.Type.NOT_CONNECTED;
                                        return;
                                    }

                                    isConnection = true;
                                    return this._daemonRepo.getActingAs(daemon, connection)
                                        .then(actingAs => {
                                            if (!actingAs)
                                                type = this.tracker.Tree.Type.NOT_CONNECTED;
                                            else
                                                type = (actingAs == 'server' ? this.tracker.Tree.Type.SERVER : this.tracker.Tree.Type.CLIENT);
                                        });
                                })
                                .then(() => {
                                    return this._pathRepo.findByParent(path);
                                })
                                .then(paths => {
                                    if (!paths.length)
                                        return;

                                    return paths.reduce((prev, cur) => {
                                        return prev.then(() => {
                                            return loadTree(nodes, cur);
                                        });
                                    }, Promise.resolve());
                                })
                                .then(() => {
                                    tree.push(this.tracker.Tree.create({
                                        tree: nodes,
                                        connection: isConnection,
                                        type: type,
                                        name: path.name,
                                        path: path.path,
                                        serverToken: connection ? connection.token : '',
                                        clientToken: path.token,
                                    }));
                                });
                        });
                };

                return Promise.resolve()
                    .then(() => {
                        if (message.treeRequest.path.length)
                            return this._pathRepo.findByUserAndPath(daemon.userId, message.treeRequest.path);

                        return this._pathRepo.findUserRoots(daemon.userId);
                    })
                    .then(paths => {
                        if (!paths.length) {
                            let response = this.tracker.TreeResponse.create({
                                response: this.tracker.TreeResponse.Result.PATH_NOT_FOUND,
                            });
                            let reply = this.tracker.ServerMessage.create({
                                type: this.tracker.ServerMessage.Type.TREE_RESPONSE,
                                messageId: message.messageId,
                                treeResponse: response,
                            });
                            let data = this.tracker.ServerMessage.encode(reply).finish();
                            debug(`Sending TREE RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                            return this.tracker.send(id, data);
                        }

                        return paths.reduce((prev, cur) => {
                                return prev.then(() => {
                                    return loadTree(treeRoots, cur);
                                });
                            }, Promise.resolve())
                            .then(() => {
                                let root = this.tracker.Tree.create({
                                    tree: treeRoots,
                                    connection: false,
                                    type: this.tracker.Tree.Type.NOT_CONNECTED,
                                    name: 'tree',
                                    path: message.treeRequest.path || '/',
                                });
                                let response = this.tracker.TreeResponse.create({
                                    response: this.tracker.TreeResponse.Result.ACCEPTED,
                                    tree: root,
                                });
                                let reply = this.tracker.ServerMessage.create({
                                    type: this.tracker.ServerMessage.Type.TREE_RESPONSE,
                                    messageId: message.messageId,
                                    treeResponse: response,
                                });
                                let data = this.tracker.ServerMessage.encode(reply).finish();
                                debug(`Sending TREE RESPONSE to ${client.socket.remoteAddress}:${client.socket.remotePort}`);
                                return this.tracker.send(id, data);
                            });
                    });
            })
            .catch(error => {
                this._tracker._logger.error(new WError(error, 'TreeRequest.onMessage()'));
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

module.exports = TreeRequest;