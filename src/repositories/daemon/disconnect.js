/**
 * DaemonRepository.disconnect()
 */
'use strict';

const NError = require('nerror');

/**
 * Disassociate daemon with a connection
 * @method connect
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {DaemonModel} daemon              Daemon model
 * @param {ConnectionModel} connection      Connection model
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to a number of connections removed
 */
module.exports = async function (daemon, connection, pg) {
    let client;

    try {
        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let result = await client.query(
            `DELETE
               FROM daemon_connections
              WHERE daemon_id = $1
                AND connection_id = $2`,
            [
                typeof daemon === 'object' ? daemon.id : daemon,
                typeof connection === 'object' ? connection.id : connection,
            ]
        );

        if (typeof pg !== 'object')
            client.done();

        return result.rowCount;
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { daemon, connection }, 'DaemonRepository.disconnect()');
    }
};
