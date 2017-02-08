/**
 * UserRepository.save()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Save user
 * @method save
 * @memberOf module:repositories/user~UserRepository
 * @param {UserModel} user                  User model
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to record ID
 */
module.exports = function (user, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg == 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            return Promise.resolve()
                .then(() => {
                    let data = this._postgres.constructor.serializeModel(user);
                    let fields = Object.keys(data)
                        .filter(field => {
                            return field != 'id';
                        });

                    let query, params = [];
                    if (user.id) {
                        query = 'UPDATE users SET ';
                        query += fields
                            .map(field => {
                                params.push(data[field]);
                                return `${field} = $${params.length}`;
                            })
                            .join(', ');
                        params.push(data.id);
                        query += ` WHERE id = $${params.length}`;
                    } else {
                        query = 'INSERT INTO users(';
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
                        throw new Error('Failed to ' + (user.id ? 'UPDATE' : 'INSERT') + ' row');

                    if (!user.id) {
                        user.id = result.rows[0].id;
                        user._dirty = false;
                    }

                    return user.id;
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
            throw new WError(error, 'UserRepository.save()');
        });
};
