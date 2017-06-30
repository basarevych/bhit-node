/**
 * PathRepository.delete()
 */
'use strict';

const NError = require('nerror');

/**
 * Delete a path
 * @method delete
 * @memberOf module:repositories/path~PathRepository
 * @param {PathModel|number} path           Path model or ID
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to number of deleted records
 */
module.exports = function (path, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg === 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            let connectionRepo = this.getRepository('connection');
            return client.transaction({ name: 'path_delete' }, rollback => {
                    return connectionRepo.findByPath(path, client)
                        .then(paths => {
                            if (paths.length)
                                return 0;

                            return Promise.resolve()
                                .then(() => {
                                    if (typeof path === 'object')
                                        return [ path ];

                                    return this.find(path, client);
                                })
                                .then(paths => {
                                    path = paths.length && paths[0];
                                    if (!path)
                                        return rollback(0);

                                    return client.query(
                                            'DELETE ' +
                                            '  FROM paths ' +
                                            ' WHERE id = $1 ',
                                            [ path.id ]
                                        )
                                        .then(result => {
                                            if (!path.parentId)
                                                return result.rowCount;

                                            return this.findByParent(path.parentId, client)
                                                .then(paths => {
                                                    if (!paths.length)
                                                        return this.delete(path.parentId, client);

                                                    return 0;
                                                })
                                                .then(count => {
                                                    return result.rowCount + count;
                                                });
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
            throw new NError(error, { path }, 'PathRepository.delete()');
        });
};
