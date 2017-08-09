/**
 * DaemonRepository.getActingAs()
 */
'use strict';

const NError = require('nerror');

/**
 * Find out daemon role in the connection
 * @method getActingAs
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {DaemonModel} daemon              Daemon model
 * @param {ConnectionModel} connection      Connection model
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to false, 'server' or 'client'
 */
module.exports = function (daemon, connection, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg === 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            return client.transaction({ name: 'daemon_connect' }, rollback => {
                    return client.query(
                            `SELECT *
                               FROM daemon_connections
                              WHERE daemon_id = $1
                                AND connection_id = $2`,
                            [
                                typeof daemon === 'object' ? daemon.id : daemon,
                                typeof connection === 'object' ? connection.id : connection,
                            ]
                        )
                        .then(result => {
                            if (!result.rowCount)
                                return false;

                            return result.rows[0].acting_as;
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
            throw new NError(error, { daemon, connection }, 'DaemonRepository.getActingAs()');
        });
};
