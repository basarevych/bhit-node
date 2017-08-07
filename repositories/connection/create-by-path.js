/**
 * ConnectionRepository.connectPath()
 */
'use strict';

const NError = require('nerror');

/**
 * Create connection by path and new model
 * @method createByPath
 * @memberOf module:repositories/connection~ConnectionRepository
 * @param {string} path                     Path
 * @param {ConnectionModel} connection      Unsaved connection model
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to { connection, path } (but will be null on failure)
 */
module.exports = function (path, connection, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg === 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            let pathRepo = this.getRepository('path');
            let createPath = path => {
                return pathRepo.findByUserAndPath(connection.userId, path, client)
                    .then(paths => {
                        if (paths.length)
                            return paths[0];

                        let parts = path.split('/');
                        let name = parts.pop();
                        return Promise.resolve()
                            .then(() => {
                                if (parts.length <= 1)
                                    return null;

                                return createPath(parts.join('/'));
                            })
                            .then(parent => {
                                let node = pathRepo.getModel('path');
                                node.parentId = parent ? parent.id : null;
                                node.userId = connection.userId;
                                node.name = name.trim();
                                node.path = path;
                                node.token = this.generateToken();
                                return pathRepo.save(node, client)
                                    .then(nodeId => {
                                        if (!nodeId)
                                            throw new Error('Could not create path');

                                        return node;
                                    });
                            });
                    });
            };
            return client.transaction({ name: 'connection_create_by_path' }, rollback => {
                    return pathRepo.findByUserAndPath(connection.userId, path, client)
                        .then(paths => {
                            if (paths.length)
                                return rollback({ connection: null, path: null });

                            return createPath(path)
                                .then(node => {
                                    connection.pathId = node.id;
                                    return this.save(connection, client)
                                        .then(connectionId => {
                                            if (!connectionId)
                                                throw new Error('Could not create connection');

                                            return {
                                                connection: connection,
                                                path: node,
                                            };
                                        });
                                });
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
            throw new NError(error, { path, connection }, 'ConnectionRepository.createByPath()');
        });
};
