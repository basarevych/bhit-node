/**
 * ConnectionRepository.save()
 */
'use strict';

const NError = require('nerror');

/**
 * Save connection
 * @method save
 * @memberOf module:repositories/connection~ConnectionRepository
 * @param {ConnectionModel} connection      Connection model
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to record ID
 */
module.exports = function (connection, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg === 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            return Promise.resolve()
                .then(() => {
                    let data = connection._serialize();
                    let fields = Object.keys(data)
                        .filter(field => {
                            return [ 'id', 'acting_as', 'address_override', 'port_override' ].indexOf(field) === -1;
                        });

                    let query, params = [];
                    if (connection.id) {
                        query = 'UPDATE connections SET ';
                        query += fields
                            .map(field => {
                                params.push(data[field]);
                                return `${field} = $${params.length}`;
                            })
                            .join(', ');
                        params.push(data.id);
                        query += ` WHERE id = $${params.length}`;
                    } else {
                        query = 'INSERT INTO connections(';
                        query += fields.join(', ');
                        query += ') VALUES (';
                        query += fields
                            .map(field => {
                                params.push(data[field]);
                                return `$${params.length}`;
                            })
                            .join(', ');
                        query += ') RETURNING id';
                    }
                    return client.query(query, params);
                })
                .then(result => {
                    if (result.rowCount !== 1)
                        throw new Error('Failed to ' + (connection.id ? 'UPDATE' : 'INSERT') + ' row');

                    if (!connection.id) {
                        connection.id = result.rows[0].id;
                        connection._dirty = false;
                    }

                    return connection.id;
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
        .catch(error => {
            throw new NError(error, { connection }, 'ConnectionRepository.save()');
        });
};
