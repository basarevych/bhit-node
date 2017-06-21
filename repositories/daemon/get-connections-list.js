/**
 * DaemonRepository.getConnectionsList()
 */
'use strict';

const NError = require('nerror');

/**
 * Find connections of a daemon in the protocol form
 * @method getConnectionsList
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {DaemonModel|number} daemon       Daemon model or ID
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to false, 'server' or 'client'
 */
module.exports = function (daemon, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg === 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            let userRepo = this.getRepository('user');
            let connectionRepo = this.getRepository('connection');
            let pathRepo = this.getRepository('path');
            return client.transaction({ name: 'daemon_connections_list' }, rollback => {
                    let list = {
                        serverConnections: [],
                        clientConnections: [],
                    };

                    return Promise.resolve()
                        .then(() => {
                            if (typeof daemon === 'object')
                                return daemon;

                            return this.find(daemon)
                                .then(daemons => {
                                    return daemons.length && daemons[0];
                                });
                        })
                        .then(daemon => {
                            if (!daemon)
                                return null;

                            return userRepo.find(daemon.userId)
                                .then(users => {
                                    let user = users.length && users[0];
                                    if (!user)
                                        return null;

                                    let getFullName = peer => {
                                        return userRepo.find(peer.userId)
                                            .then(owners => {
                                                let owner = owners.length && owners[0];
                                                if (!owner)
                                                    return null;

                                                return owner.email + '?' + peer.name;
                                            });
                                    };

                                    return connectionRepo.findByDaemon(daemon)
                                        .then(connections => {
                                            let promises = [];
                                            for (let connection of connections) {
                                                if (connection.actingAs === 'server') {
                                                    promises.push(
                                                        pathRepo.find(connection.pathId)
                                                            .then(paths => {
                                                                let path = paths.length && paths[0];
                                                                if (!path)
                                                                    return null;

                                                                let info = {
                                                                    name: user.email + path.path,
                                                                    connectAddress: connection.addressOverride || connection.connectAddress || '',
                                                                    connectPort: connection.portOverride || connection.connectPort || '',
                                                                    encrypted: connection.encrypted,
                                                                    fixed: connection.fixed,
                                                                    clients: [],
                                                                };

                                                                if (!connection.fixed)
                                                                    return info;

                                                                return this.findByConnection(connection)
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

                                                                                        info.clients.push(name);
                                                                                    })
                                                                            );
                                                                        }

                                                                        if (peerPromises.length)
                                                                            return Promise.all(peerPromises);
                                                                    })
                                                                    .then(() => {
                                                                        return info;
                                                                    })
                                                            })
                                                            .then(info => {
                                                                if (info)
                                                                    list.serverConnections.push(info);
                                                            })
                                                    );
                                                } else if (connection.actingAs === 'client') {
                                                    promises.push(
                                                        this.findServerByConnection(connection)
                                                            .then(servers => {
                                                                let server = servers.length && servers[0];
                                                                if (!server)
                                                                    return;

                                                                return Promise.all([
                                                                        getFullName(server),
                                                                        pathRepo.find(connection.pathId),
                                                                    ])
                                                                    .then(([name, paths]) => {
                                                                        let path = paths.length && paths[0];
                                                                        if (!path)
                                                                            return;

                                                                        list.clientConnections.push({
                                                                            name: user.email + path.path,
                                                                            listenAddress: connection.addressOverride || connection.listenAddress || '',
                                                                            listenPort: connection.addressOverride || connection.listenPort || '',
                                                                            encrypted: connection.encrypted,
                                                                            fixed: connection.fixed,
                                                                            server: name || '',
                                                                        });
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
                        });
                })
                .then(
                    value => {
                        if (typeof pg !== 'object')
                            client.done();
                        return value;
                    },
                    error => {
                        if (typeof pg !== 'object')
                            client.done();
                        throw error;
                    }
                );
        })
        .catch(error => {
            throw new NError(error, { daemon, connection }, 'DaemonRepository.getConnectionsList()');
        });
};
