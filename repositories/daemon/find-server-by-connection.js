/**
 * DaemonRepository.findByConnection()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Find server of a connection
 * @method findServerByConnection
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {object|number} connection        Connection to search by
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = function (connection, pg) {
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
                    '     WHERE dc.connection_id = $1 ' +
                    '       AND dc.acting_as = $2 ',
                    [
                        typeof connection === 'object' ? connection.id : connection,
                        'server',
                    ]
                )
                .then(result => {
                    return result.rowCount ? result.rows : [];
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
            throw new WError(error, 'DaemonRepository.findServerByConnection()');
        });
};
