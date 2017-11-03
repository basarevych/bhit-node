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
module.exports = async function (path, connection, pg) {
    let client;

    try {
        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let pathRepo = this.getRepository('path');

        let createPath = async path => {
            let paths = await pathRepo.findByUserAndPath(connection.userId, path, client);
            if (paths.length)
                return paths[0];

            let parts = path.split('/');
            let name = parts.pop();

            let parent = null;
            if (parts.length > 1)
                parent = await createPath(parts.join('/'));

            let node = pathRepo.getModel('path');
            node.parentId = parent ? parent.id : null;
            node.userId = connection.userId;
            node.name = name.trim();
            node.path = path;
            node.token = this.generateToken();
            let nodeId = await pathRepo.save(node, client);
            if (!nodeId)
                throw new Error('Could not create path');

            return node;
        };

        let value = await client.transaction({ name: 'connection_create_by_path' }, async rollback => {
            let paths = await pathRepo.findByUserAndPath(connection.userId, path, client);
            if (paths.length)
                return rollback({ connection: null, path: null });

            let node = await createPath(path);
            connection.pathId = node.id;
            let connectionId = await this.save(connection, client);
            if (!connectionId)
                throw new Error('Could not create connection');

            return {
                connection: connection,
                path: node,
            };
        });

        if (typeof pg !== 'object')
            client.done();

        return value;
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { path, connection }, 'ConnectionRepository.createByPath()');
    }
};
