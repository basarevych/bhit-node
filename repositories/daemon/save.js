/**
 * DaemonRepository.save()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Save daemon
 * @method save
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {DaemonModel} daemon              Daemon model
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to record ID
 */
module.exports = function (daemon, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg == 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            return Promise.resolve()
                .then(() => {
                    let data = this._postgres.constructor.serializeModel(daemon);
                    let fields = Object.keys(data)
                        .filter(field => {
                            return field != 'id';
                        });

                    let query, params = [];
                    if (daemon.id) {
                        query = 'UPDATE daemons SET ';
                        query += fields
                            .map(field => {
                                params.push(data[field]);
                                return `${field} = $${params.length}`;
                            })
                            .join(', ');
                        params.push(data.id);
                        query += ` WHERE id = ${params.length}`;
                    } else {
                        query = 'INSERT INTO daemons(';
                        query += fields.join(', ');
                        query += ') VALUES (';
                        query += fields
                            .map(field => {
                                params.push(data[field]);
                                return `$${params.length}`;
                            })
                            .join(', ');
                        query += ')';
                    }
                    query += ' RETURNING id';
                    return client(query, params);
                })
                .then(result => {
                    let id = (result.rowCount && result.rows[0].id) || null;
                    if (!id)
                        throw new Error('Unexpected error: no ID');

                    daemon.id = id;
                    daemon._dirty = false;
                    return id;
                })
                .then(
                    value => {
                        if (typeof pg != 'object')
                            client.done();
                        return value;
                    },
                    error => {
                        if (typeof pg != 'object')
                            client.done();
                        throw error;
                    }
                );
        })
        .catch(error => {
            throw new WError(error, 'DaemonRepository.save()');
        });
};
