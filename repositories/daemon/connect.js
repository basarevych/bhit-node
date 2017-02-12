/**
 * DaemonRepository.connect()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Associate daemon with a connection
 * @method connect
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {DaemonModel} daemon              Daemon model
 * @param {ConnectionModel} connection      Connection model
 * @param {string} actingAs                 'server' or 'client'
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to a number of connections made
 */
module.exports = function (daemon, connection, actingAs, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg == 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            return client.transaction({ name: 'daemon_connect' }, rollback => {
                    return client.query(
                            'SELECT * ' +
                            '  FROM daemon_connections ' +
                            ' WHERE daemon_id = $1 ' +
                            '   AND connection_id = $2 ',
                            [
                                typeof daemon == 'object' ? daemon.id : daemon,
                                typeof connection == 'object' ? connection.id : connection,
                            ]
                        )
                        .then(result => {
                            if (result.rowCount)
                                return 0;

                            return Promise.resolve()
                                .then(() => {
                                    if (actingAs == 'client')
                                        return true;

                                    return client.query(
                                            'SELECT * ' +
                                            '  FROM daemon_connections ' +
                                            ' WHERE connection_id = $1 ' +
                                            '   AND acting_as = "server" ',
                                            [
                                                typeof connection == 'object' ? connection.id : connection,
                                            ]
                                        )
                                        .then(result => {
                                            return result.length === 0;
                                        });
                                })
                                .then(valid => {
                                    if (!valid)
                                        return 0;

                                    return client.query(
                                            'INSERT ' +
                                            '  INTO daemon_connections(daemon_id, connection_id, acting_as) ' +
                                            'VALUES ($1, $2, $3) ',
                                            [
                                                typeof daemon == 'object' ? daemon.id : daemon,
                                                typeof connection == 'object' ? connection.id : connection,
                                                actingAs
                                            ]
                                        )
                                        .then(() => {
                                            return 1;
                                        });
                                });
                        });
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
            throw new WError(error, 'DaemonRepository.connect()');
        });
};
