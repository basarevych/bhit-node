/**
 * DaemonRepository.findByConnection()
 */
'use strict';

const NError = require('nerror');

/**
 * Find daemons by connection
 * @method findByConnection
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {object|number} connection        Connection to search by
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = async function (connection, pg) {
    let key = `sql:${this.constructor.table}-by-connection-id:${typeof connection === 'object' ? connection.id : connection}`;
    let client;

    try {
        if (this._enableCache) {
            let value = await this._cacher.get(key);
            if (value)
                return this.getModel(value);
        }

        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let result = await client.query(
            `    SELECT d.*, dc.acting_as
                   FROM daemons d
             INNER JOIN daemon_connections dc
                     ON d.id = dc.daemon_id
                  WHERE dc.connection_id = $1`,
            [ typeof connection === 'object' ? connection.id : connection ]
        );
        let rows = result.rowCount ? result.rows : [];

        if (this._enableCache)
            await this._cacher.set(key, rows);

        if (typeof pg !== 'object')
            client.done();

        return this.getModel(rows);
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { connection }, 'DaemonRepository.findByConnection()');
    }
};
