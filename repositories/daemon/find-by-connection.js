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
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = function (connection, pg) {
    let key = `sql:daemon-connections-by-connection-id:${typeof connection === 'object' ? connection.id : connection}`;

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
                            '    SELECT d.*, dc.acting_as ' +
                            '      FROM daemons d ' +
                            'INNER JOIN daemon_connections dc ' +
                            '        ON d.id = dc.daemon_id ' +
                            '     WHERE dc.connection_id = $1 ',
                            [ typeof connection === 'object' ? connection.id : connection ]
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
                let model = this.getModel('daemon');
                model._unserialize(row);
                models.push(model);
            }

            return models;
        })
        .catch(error => {
            throw new NError(error, { connection }, 'DaemonRepository.findByConnection()');
        });
};
