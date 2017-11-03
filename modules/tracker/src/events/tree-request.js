/**
 * Tree Request event
 * @module tracker/events/tree-request
 */
const NError = require('nerror');

/**
 * Tree Request event class
 */
class TreeRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {Registry} registry                       Registry service
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {PathRepository} pathRepo                 Path repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, logger, registry, daemonRepo, pathRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'tracker.events.treeRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.treeRequest';
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
    async handle(id, message) {
        let client = this._registry.clients.get(id);
        if (!client)
            return;

        this._logger.debug('tree-request', `Got TREE REQUEST from ${id}`);
        try {
            let daemons = [];
            if (client.daemonId)
                daemons = await this._daemonRepo.find(client.daemonId);
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
                this._logger.debug('tree-request', `Sending REJECTED TREE RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let target;
            if (message.treeRequest.path.length) {
                target = this.tracker.validatePath(message.treeRequest.path);
                if (target && !target.email) {
                    target = target.path;
                } else {
                    let response = this.tracker.TreeResponse.create({
                        response: this.tracker.TreeResponse.Result.INVALID_PATH,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.TREE_RESPONSE,
                        messageId: message.messageId,
                        treeResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('tree-request', `Sending INVALID_PATH TREE RESPONSE to ${id}`);
                    return this.tracker.send(id, data);
                }
            }

            let loadTree = async (tree, path) => {
                let nodes = [];
                let isConnection = false;
                let type = this.tracker.Tree.Type.NOT_CONNECTED;
                let numServers = 0;
                let numClients = 0;
                let connections = await this._connectionRepo.findByPath(path);
                let connection = connections.length && connections[0];

                if (connection) {
                    isConnection = true;
                    let actingAs = await this._daemonRepo.getActingAs(daemon, connection);
                    if (actingAs)
                        type = (actingAs === 'server' ? this.tracker.Tree.Type.SERVER : this.tracker.Tree.Type.CLIENT);
                    let [countedServers, countedClients] = await Promise.all([
                        this._daemonRepo.countServers(connection),
                        this._daemonRepo.countClients(connection),
                    ]);
                    numServers = countedServers;
                    numClients = countedClients;
                }

                let paths = await this._pathRepo.findByParent(path);
                if (paths.length) {
                    await paths.reduce(
                        async (prev, cur) => {
                            await prev;
                            return loadTree(nodes, cur);
                        },
                        Promise.resolve()
                    );
                }

                tree.push(this.tracker.Tree.create({
                    tree: nodes,
                    connection: isConnection,
                    type: type,
                    name: path.name,
                    path: path.path,
                    serversNumber: parseInt(numServers),
                    connectAddress: connection.connectAddress || '',
                    connectPort: connection.connectPort || '',
                    clientsNumber: parseInt(numClients),
                    listenAddress: connection.listenAddress || '',
                    listenPort: connection.listenPort || '',
                    encrypted: connection.encrypted,
                    fixed: connection.fixed,
                }));
            };

            let paths;
            if (target)
                paths = await this._pathRepo.findByUserAndPath(daemon.userId, target);
            else
                paths = await this._pathRepo.findUserRoots(daemon.userId);

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
                this._logger.debug('tree-request', `Sending PATH_NOT_FOUND TREE RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let treeRoots = [];
            await paths.reduce(
                async (prev, cur) => {
                    await prev;
                    return loadTree(treeRoots, cur);
                },
                Promise.resolve()
            );

            let root = this.tracker.Tree.create({
                tree: treeRoots,
                connection: false,
                type: this.tracker.Tree.Type.NOT_CONNECTED,
                name: 'tree',
                path: target || '/',
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
            this._logger.debug('tree-request', `Sending ACCEPTED TREE RESPONSE to ${id}`);
            this.tracker.send(id, data);
        } catch (error) {
            this._logger.error(new NError(error, 'TreeRequest.handle()'));
        }
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
