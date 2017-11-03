/**
 * DaemonRepository.countServers()
 */
'use strict';

const NError = require('nerror');

/**
 * Count servers of a connection
 * @method countServers
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {object|number} connection        Connection to search by
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = async function (connection, pg) {
    let client;

    try {
        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let result = await client.query(
            `    SELECT COUNT(d.*) AS count
                   FROM daemons d 
             INNER JOIN daemon_connections dc
                     ON d.id = dc.daemon_id
                  WHERE dc.connection_id = $1
                    AND dc.acting_as = $2`,
            [
                typeof connection === 'object' ? connection.id : connection,
                'server',
            ]
        );

        if (typeof pg !== 'object')
            client.done();

        return result.rowCount ? result.rows[0].count : 0;
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { connection }, 'DaemonRepository.countServers()');
    }
};
