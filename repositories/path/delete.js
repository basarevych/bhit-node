/**
 * PathRepository.delete()
 */
'use strict';

const WError = require('verror').WError;

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
            if (typeof pg == 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            return client.query(
                    'DELETE ' +
                    '  FROM paths ' +
                    ' WHERE id = $1 ',
                    [ typeof path == 'object' ? path.id : path ]
                )
                .then(result => {
                    return result.rowCount;
                })
                .then(
                    value => {
                        if (typeof pg != 'object')
                            client.done();
                        return value;
                    },
                    error => {
                        if (typeof pg != 'object')
                            client.done();
                        throw error;
                    }
                );
        })
        .catch(error => {
            throw new WError(error, 'PathRepository.delete()');
        });
};
