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
module.exports = async function (daemon, connection, pg) {
    let client;

    try {
        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let value = await client.transaction({ name: 'daemon_acting_as' }, async rollback => {
            let result = await client.query(
                `SELECT *
                   FROM daemon_connections
                  WHERE daemon_id = $1
                    AND connection_id = $2`,
                [
                    typeof daemon === 'object' ? daemon.id : daemon,
                    typeof connection === 'object' ? connection.id : connection,
                ]
            );
            if (!result.rowCount)
                return false;

            return result.rows[0].acting_as;
        });

        if (typeof pg !== 'object')
            client.done();

        return value;
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { daemon, connection }, 'DaemonRepository.getActingAs()');
    }
};
