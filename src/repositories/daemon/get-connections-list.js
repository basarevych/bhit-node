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
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to false, 'server' or 'client'
 */
module.exports = async function (daemon, pg) {
    let client;

    try {
        let userRepo = this.getRepository('user');
        let connectionRepo = this.getRepository('connection');
        let pathRepo = this.getRepository('path');

        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let value = await client.transaction({ name: 'daemon_connections_list' }, async rollback => {
            let list = {
                serverConnections: [],
                clientConnections: [],
            };

            if (typeof daemon !== 'object') {
                let daemons = await this.find(daemon, client);
                daemon = daemons.length && daemons[0];
            }

            if (!daemon)
                return rollback(null);

            let users = await userRepo.find(daemon.userId, client);
            let user = users.length && users[0];
            if (!user)
                return rollback(null);

            let getFullName = async peer => {
                let owners = await userRepo.find(peer.userId, client);
                let owner = owners.length && owners[0];
                if (!owner)
                    return rollback(null);

                return owner.email + '?' + peer.name;
            };

            let connections = await connectionRepo.findByDaemon(daemon, client);
            for (let connection of connections) {
                if (connection.actingAs === 'server') {
                    let paths = await pathRepo.find(connection.pathId, client);
                    let path = paths.length && paths[0];
                    if (!path)
                        continue;

                    let { address, port } = this._registry.addressOverride(
                        connection.connectAddress,
                        connection.connectPort,
                        connection.addressOverride,
                        connection.portOverride
                    );

                    let info = {
                        name: user.email + path.path,
                        connectAddress: address,
                        connectPort: port,
                        encrypted: connection.encrypted,
                        fixed: connection.fixed,
                        clients: [],
                    };

                    if (!connection.fixed) {
                        list.serverConnections.push(info);
                        continue;
                    }

                    let peers = await this.findByConnection(connection, client);
                    for (let peer of peers) {
                        if (peer.actingAs !== 'client')
                            continue;

                        let name = await getFullName(peer);
                        if (name)
                            info.clients.push(name);
                    }

                    list.serverConnections.push(info);
                } else if (connection.actingAs === 'client') {
                    let servers = await this.findServerByConnection(connection, client);
                    let server = servers.length && servers[0];
                    if (!server)
                        continue;

                    let name = await getFullName(server);
                    let paths = await pathRepo.find(connection.pathId, client);
                    let path = paths.length && paths[0];
                    if (!path)
                        continue;

                    let { address, port } = this._registry.addressOverride(
                        connection.listenAddress,
                        connection.listenPort,
                        connection.addressOverride,
                        connection.portOverride
                    );

                    list.clientConnections.push({
                        name: user.email + path.path,
                        listenAddress: address,
                        listenPort: port,
                        encrypted: connection.encrypted,
                        fixed: connection.fixed,
                        server: name || '',
                    });
                }
            }

            return list;
        });

        if (typeof pg !== 'object')
            client.done();

        return value;
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { daemon }, 'DaemonRepository.getConnectionsList()');
    }
};
