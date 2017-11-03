/**
 * ConnectionRepository.findByDaemon()
 */
'use strict';

const NError = require('nerror');

/**
 * Find connections by daemon
 * @method findByDaemon
 * @memberOf module:repositories/connection~ConnectionRepository
 * @param {object|number} daemon            Daemon to search by
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = async function (daemon, pg) {
    let key = `sql:${this.constructor.table}-by-daemon-id:${typeof daemon === 'object' ? daemon.id : daemon}`;
    let client;

    try {
        if (this._enableCache) {
            let value = await this._cacher.get(key);
            if (value)
                return this.getModel(value);
        }

        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let result = await client.query(
            `    SELECT c.*, dc.acting_as, dc.address_override, dc.port_override 
                   FROM connections c 
             INNER JOIN daemon_connections dc 
                     ON c.id = dc.connection_id 
                  WHERE dc.daemon_id = $1`,
            [ typeof daemon === 'object' ? daemon.id : daemon ]
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

        throw new NError(error, { daemon }, 'ConnectionRepository.findByDaemon()');
    }
};
