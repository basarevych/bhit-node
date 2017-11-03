/**
 * DaemonRepository.findByConnection()
 */
'use strict';

const NError = require('nerror');

/**
 * Find server of a connection
 * @method findServerByConnection
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {ConnectionModel|number} connection   Connection to search by
 * @param {PostgresClient|string} [pg]          Will reuse the Postgres client provided, or if it is a string then will
 *                                              connect to this instance of Postgres.
 * @return {Promise}                            Resolves to array of models
 */
module.exports = async function (connection, pg) {
    let client;

    try {
        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let result = await client.query(
            `    SELECT d.*, dc.acting_as
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
        let rows = result.rowCount ? result.rows : [];

        if (typeof pg !== 'object')
            client.done();

        return this.getModel(rows);
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { connection }, 'DaemonRepository.findByConnection()');
    }
};
