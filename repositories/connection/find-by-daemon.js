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
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = function (daemon, pg) {
    let key = `sql:daemon-connections-by-daemon-id:${typeof daemon === 'object' ? daemon.id : daemon}`;

    return this._cacher.get(key)
        .then(value => {
            if (value)
                return value;

            return Promise.resolve()
                .then(() => {
                    if (typeof pg === 'object')
                        return pg;

                    return this._postgres.connect(pg);
                })
                .then(client => {
                    return client.query(
                            '    SELECT c.*, dc.acting_as, dc.address_override, dc.port_override ' +
                            '      FROM connections c ' +
                            'INNER JOIN daemon_connections dc ' +
                            '        ON c.id = dc.connection_id ' +
                            '     WHERE dc.daemon_id = $1 ',
                            [ typeof daemon === 'object' ? daemon.id : daemon ]
                        )
                        .then(result => {
                            let rows = result.rowCount ? result.rows : [];
                            if (!rows.length)
                                return rows;

                            return this._cacher.set(key, rows)
                                .then(() => {
                                    return rows;
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
                });
        })
        .then(rows => {
            let models = [];
            for (let row of rows) {
                let model = this.getModel('connection');
                model._unserialize(row);
                models.push(model);
            }

            return models;
        })
        .catch(error => {
            throw new NError(error, { daemon }, 'ConnectionRepository.findByDaemon()');
        });
};
