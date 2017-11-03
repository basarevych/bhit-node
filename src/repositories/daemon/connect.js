/**
 * DaemonRepository.connect()
 */
'use strict';

const NError = require('nerror');

/**
 * Associate daemon with a connection
 * @method connect
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {DaemonModel} daemon              Daemon model
 * @param {ConnectionModel} connection      Connection model
 * @param {string} actingAs                 'server' or 'client'
 * @param {string} [addressOverride]        Override address
 * @param {string} [portOverride]           Override port
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to a number of connections made
 */
module.exports = async function (daemon, connection, actingAs, addressOverride, portOverride, pg) {
    let client;

    try {
        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let value = await client.transaction({ name: 'daemon_connect' }, async rollback => {
            let result = client.query(
                `SELECT * 
                   FROM daemon_connections 
                  WHERE daemon_id = $1 
                    AND connection_id = $2`,
                [
                    typeof daemon === 'object' ? daemon.id : daemon,
                    typeof connection === 'object' ? connection.id : connection,
                ]
            );
            if (result.rowCount)
                return 0;

            if (actingAs === 'server') {
                result = await client.query(
                    `SELECT * 
                       FROM daemon_connections 
                      WHERE connection_id = $1
                        AND acting_as = $2`,
                    [
                        typeof connection === 'object' ? connection.id : connection,
                        'server',
                    ]
                );
                if (result.rowCount)
                    return 0;
            }

            result = await client.query(
                `INSERT
                   INTO daemon_connections(daemon_id, connection_id, acting_as, address_override, port_override)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    typeof daemon === 'object' ? daemon.id : daemon,
                    typeof connection === 'object' ? connection.id : connection,
                    actingAs,
                    addressOverride || null,
                    portOverride || null,
                ]
            );
            return result.rowCount;
        });

        if (typeof pg !== 'object')
            client.done();

        return value;
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { daemon, connection, actingAs, addressOverride, portOverride }, 'DaemonRepository.connect()');
    }
};
