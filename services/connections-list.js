/**
 * Connections List service
 * @module services/connections-list
 */
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Connections List service class
 */
class ConnectionsList {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {UserRepository} userRepo                 User repository
     * @param {DaemonRepository} daemonRepo             Daemon repository
     * @param {PathRepository} pathRepo                 Path repository
     * @param {ConnectionRepository} connectionRepo     Connection repository
     */
    constructor(app, config, logger, userRepo, daemonRepo, pathRepo, connectionRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._pathRepo = pathRepo;
        this._connectionRepo = connectionRepo;
    }

    /**
     * Service name is 'connectionsList'
     * @type {string}
     */
    static get provides() {
        return 'connectionsList';
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
            'repositories.user',
            'repositories.daemon',
            'repositories.path',
            'repositories.connection'
        ];
    }

    /**
     * This service is a singleton
     * @type {string}
     */
    static get lifecycle() {
        return 'singleton';
    }

    /**
     * Event handler
     * @param {string} daemonId             ID of the daemon
     * @return {Promise}
     */
    getList(daemonId) {
        let list = this.tracker.ConnectionsList.create({
            serverConnections: [],
            clientConnections: [],
        });

        return this._daemonRepo.find(daemonId)
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon)
                    return null;

                return this._userRepo.find(daemon.userId)
                    .then(users => {
                        let user = users.length && users[0];
                        if (!user)
                            return null;

                        let getFullName = peer => {
                            return this._userRepo.find(peer.userId)
                                .then(owners => {
                                    let owner = owners.length && owners[0];
                                    if (!owner)
                                        return null;

                                    return owner.email + '?' + peer.name;
                                });
                        };

                        return this._connectionRepo.findByDaemon(daemon)
                            .then(connections => {
                                let promises = [];
                                for (let connection of connections) {
                                    if (connection.actingAs === 'server') {
                                        if (!connection.fixed) {
                                            promises.push(
                                                this._pathRepo.find(connection.pathId)
                                                    .then(paths => {
                                                        let path = paths.length && paths[0];
                                                        if (!path)
                                                            return;

                                                        list.serverConnections.push(this.tracker.ServerConnection.create({
                                                            name: user.email + path.path,
                                                            connectAddress: connection.addressOverride || connection.connectAddress || '',
                                                            connectPort: connection.portOverride || connection.connectPort || '',
                                                            encrypted: connection.encrypted,
                                                            fixed: connection.fixed,
                                                            clients: [],
                                                        }));
                                                    })
                                            );
                                            continue;
                                        }

                                        let clients = [];
                                        promises.push(
                                            this._daemonRepo.findByConnection(connection)
                                                .then(peers => {
                                                    let peerPromises = [];
                                                    for (let peer of peers) {
                                                        if (peer.actingAs !== 'client')
                                                            continue;
                                                        peerPromises.push(
                                                            getFullName(peer)
                                                                .then(name => {
                                                                    if (!name)
                                                                        return;

                                                                    clients.push(name);
                                                                })
                                                        );
                                                    }

                                                    if (peerPromises.length)
                                                        return Promise.all(peerPromises);
                                                })
                                                .then(() => {
                                                    return this._pathRepo.find(connection.pathId);
                                                })
                                                .then(paths => {
                                                    let path = paths.length && paths[0];
                                                    if (!path)
                                                        return;

                                                    list.serverConnections.push(this.tracker.ServerConnection.create({
                                                        name: user.email + path.path,
                                                        connectAddress: connection.addressOverride || connection.connectAddress || '',
                                                        connectPort: connection.portOverride || connection.connectPort || '',
                                                        encrypted: connection.encrypted,
                                                        fixed: connection.fixed,
                                                        clients: clients,
                                                    }));
                                                })
                                        );
                                    } else if (connection.actingAs === 'client') {
                                        promises.push(
                                            this._daemonRepo.findServerByConnection(connection)
                                                .then(servers => {
                                                    let server = servers.length && servers[0];
                                                    if (!server)
                                                        return;

                                                    return Promise.all([
                                                            getFullName(server),
                                                            this._pathRepo.find(connection.pathId),
                                                        ])
                                                        .then(([ name , paths ]) => {
                                                            let path = paths.length && paths[0];
                                                            if (!path)
                                                                return;

                                                            list.clientConnections.push(this.tracker.ClientConnection.create({
                                                                name: user.email + path.path,
                                                                listenAddress: connection.addressOverride || connection.listenAddress || '',
                                                                listenPort: connection.addressOverride || connection.listenPort || '',
                                                                encrypted: connection.encrypted,
                                                                fixed: connection.fixed,
                                                                server: name || '',
                                                            }));
                                                        });
                                                })
                                        );
                                    }
                                }
                                if (promises.length)
                                    return Promise.all(promises);
                            })
                            .then(() => {
                                return list;
                            });
                    })
            })
            .catch(error => {
                this._logger.error(new WError(error, 'ConnectionsList.getList()'));
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

module.exports = ConnectionsList;