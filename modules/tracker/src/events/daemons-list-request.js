/**
 * Daemons List Request event
 * @module tracker/events/daemons-list-request
 */
const NError = require('nerror');

/**
 * Daemons List Request event class
 */
class DaemonsListRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {Registry} registry                       Registry service
     * @param {UserRepository} userRepo                 User repository
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {PathRepository} pathRepo                 Path repository
     * @param {ConnectionRepository} connRepo           Connection repository
     */
    constructor(app, config, logger, registry, userRepo, daemonRepo, pathRepo, connRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
        this._connRepo = connRepo;
    }

    /**
     * Service name is 'tracker.events.daemonsListRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.daemonsListRequest';
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
            'repositories.connection',
        ];
    }

    /**
     * Event name
     * @type {string}
     */
    get name() {
        return 'daemons_list_request';
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

        this._logger.debug('daemons-list-request', `Got DAEMONS LIST REQUEST from ${id}`);
        try {
            let daemons = [];
            if (client.daemonId)
                daemons = await this._daemonRepo.find(client.daemonId);
            let daemon = daemons.length && daemons[0];
            if (!daemon) {
                let response = this.tracker.DaemonsListResponse.create({
                    response: this.tracker.DaemonsListResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.DAEMONS_LIST_RESPONSE,
                    messageId: message.messageId,
                    daemonsListResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('daemons-list-request', `Sending REJECTED DAEMONS LIST RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let users = await this._userRepo.find(daemon.userId);
            let user = users.length && users[0];
            if (!user) {
                let response = this.tracker.DaemonsListResponse.create({
                    response: this.tracker.DaemonsListResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.DAEMONS_LIST_RESPONSE,
                    messageId: message.messageId,
                    daemonsListResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('daemons-list-request', `Sending REJECTED DAEMONS LIST RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let search;
            if (message.daemonsListRequest.path) {
                let path = this._registry.validatePath(message.daemonsListRequest.path);
                if (!path || (path.email && path.email !== user.email)) {
                    let response = this.tracker.DaemonsListResponse.create({
                        response: this.tracker.DaemonsListResponse.Result.INVALID_PATH,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.DAEMONS_LIST_RESPONSE,
                        messageId: message.messageId,
                        daemonsListResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('daemons-list-request', `Sending INVALID_PATH DAEMONS LIST RESPONSE to ${id}`);
                    return this.tracker.send(id, data);
                }
                search = path.path;
            }

            daemons = [];
            if (!search) {
                daemons = await this._daemonRepo.findByUser(user);
            } else {
                let paths = await this._pathRepo.findByUserAndPath(user, search);
                let path = paths.length && paths[0];
                if (path) {
                    let connections = await this._connRepo.findByPathRecursive(path);
                    await connections.reduce(
                        async (prev, cur) => {
                            await prev;
                            let newDaemons = await this._daemonRepo.findByConnection(cur);
                            for (let newDaemon of newDaemons) {
                                let found = false;
                                for (let oldDaemon of daemons) {
                                    if (oldDaemon.id === newDaemon.id) {
                                        found = true;
                                        break;
                                    }
                                }
                                if (!found)
                                    daemons.push(newDaemon);
                            }
                        },
                        Promise.resolve()
                    );
                }
            }

            if (!daemons.length) {
                let response = this.tracker.DaemonsListResponse.create({
                    response: this.tracker.DaemonsListResponse.Result.PATH_NOT_FOUND,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.DAEMONS_LIST_RESPONSE,
                    messageId: message.messageId,
                    daemonsListResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('daemons-list-request', `Sending PATH_NOT_FOUND DAEMONS LIST RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            users = new Map();
            await daemons.reduce(
                async (prev, cur) => {
                    await prev;
                    if (users.has(cur.userId))
                        return;

                    let newUsers = await this._userRepo.find(cur.userId);
                    if (newUsers.length)
                        users.set(newUsers[0].id, newUsers[0]);
                },
                Promise.resolve()
            );

            let list = [];
            for (let daemon of daemons) {
                let info;
                for (let [daemonId, daemonInfo] of this._registry.daemons) {
                    if (daemonId === daemon.id) {
                        info = daemonInfo;
                        break;
                    }
                }

                let user = users.get(daemon.userId);

                if (!info || !info.clients.size) {
                    list.push(this.tracker.Daemon.create({
                        name: (user ? `${user.email}?` : '') + daemon.name,
                        online: false,
                        server: daemon.actingAs === 'server',
                        client: daemon.actingAs === 'client',
                        version: '',
                        hostname: '',
                        externalAddress: '',
                        internalAddresses: [],
                    }));
                    continue;
                }

                for (let clientId of info.clients) {
                    let clientInfo = this._registry.clients.get(clientId);
                    if (!clientInfo)
                        continue;

                    let socketInfo = this.tracker.clients.get(clientId);

                    let internal = [];
                    for (let ip of Array.from(clientInfo.ips)) {
                        if (internal.indexOf(ip) === -1)
                            internal.push(ip);
                    }

                    list.push(this.tracker.Daemon.create({
                        name: (user ? `${user.email}?` : '') + daemon.name,
                        online: true,
                        server: daemon.actingAs === 'server',
                        client: daemon.actingAs === 'client',
                        version: clientInfo.version || '',
                        hostname: clientInfo.hostname || '',
                        externalAddress: (socketInfo && socketInfo.socket.remoteAddress) || '',
                        internalAddresses: internal,
                    }));
                }
            }

            let response = this.tracker.DaemonsListResponse.create({
                response: this.tracker.DaemonsListResponse.Result.ACCEPTED,
                list: list,
            });
            let reply = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.DAEMONS_LIST_RESPONSE,
                messageId: message.messageId,
                daemonsListResponse: response,
            });
            let data = this.tracker.ServerMessage.encode(reply).finish();
            this._logger.debug('daemons-list-request', `Sending ACCEPTED DAEMONS LIST RESPONSE to ${id}`);
            this.tracker.send(id, data);
        } catch (error) {
            this._logger.error(new NError(error, 'DaemonsListRequest.handle()'));
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

module.exports = DaemonsListRequest;
