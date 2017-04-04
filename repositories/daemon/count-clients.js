/**
 * DaemonRepository.countClients()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Count clients of a connection
 * @method countServers
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {object|number} connection        Connection to search by
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = function (connection, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg === 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            return client.query(
                    '    SELECT COUNT(d.*) AS count ' +
                    '      FROM daemons d ' +
                    'INNER JOIN daemon_connections dc ' +
                    '        ON d.id = dc.daemon_id ' +
                    '     WHERE dc.connection_id = $1 ' +
                    '       AND dc.acting_as = $2 ',
                    [
                        typeof connection === 'object' ? connection.id : connection,
                        'client',
                    ]
                )
                .then(result => {
                    return result.rowCount ? result.rows[0].count : 0;
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
            throw new WError(error, 'DaemonRepository.countClients()');
        });
};
