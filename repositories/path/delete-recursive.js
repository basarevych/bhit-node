/**
 * PathRepository.deleteRecursive()
 */
'use strict';

const NError = require('nerror');

/**
 * Delete a path recursively
 * @method deleteRecursive
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
            return client.transaction({ name: 'path_delete_recursive' }, rollback => {
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

                                return this.delete(path.parentId, client)
                                    .then(count => {
                                        return result.rowCount + count;
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
            throw new NError(error, { path }, 'PathRepository.deleteRecursive()');
        });
};
