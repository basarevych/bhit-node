/**
 * ConnectionRepository.delete()
 */
'use strict';

const NError = require('nerror');

/**
 * Delete a connection
 * @method delete
 * @memberOf module:repositories/connection~ConnectionRepository
 * @param {ConnectionModel|number} connection   Connection model or ID
 * @param {PostgresClient|string} [pg]          Will reuse the Postgres client provided, or if string then will connect
 *                                              to this instance of Postgres.
 * @return {Promise}                            Resolves to number of deleted records
 */
module.exports = function (connection, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg === 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            let pathRepo = this.getRepository('path');
            return client.transaction({ name: 'connection_delete' }, rollback => {
                    return client.query(
                            'DELETE ' +
                            '  FROM connections ' +
                            ' WHERE id = $1 ',
                            [ typeof connection === 'object' ? connection.id : connection ]
                        )
                        .then(result => {
                            return pathRepo.delete(connection.pathId, client)
                                .then(() => {
                                    return result.rowCount;
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
            throw new NError(error, { connection }, 'ConnectionRepository.delete()');
        });
};
