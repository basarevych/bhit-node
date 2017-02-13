/**
 * PathRepository.findUserRoots()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Find all root level nodes by user
 * @method findUserRoots
 * @memberOf module:repositories/path~PathRepository
 * @param {UserModel|number} user           User model
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = function (user, pg) {
    let key = `sql:paths-by-user-id-and-path:${typeof user == 'object' ? user.id : user}:/`;

    return this._cacher.get(key)
        .then(value => {
            if (value)
                return value;

            return Promise.resolve()
                .then(() => {
                    if (typeof pg == 'object')
                        return pg;

                    return this._postgres.connect(pg);
                })
                .then(client => {
                    return client.query(
                            '  SELECT * ' +
                            '    FROM paths ' +
                            '   WHERE user_id = $1 ' +
                            '     AND parent_id IS NULL ' +
                            'ORDER BY name ASC ',
                            [
                                typeof user == 'object' ? user.id : user,
                            ]
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
                });
        })
        .then(rows => {
            let models = [];
            for (let row of rows) {
                let model = this.create();
                this._postgres.constructor.unserializeModel(model, row);
                models.push(model);
            }

            return models;
        })
        .catch(error => {
            throw new WError(error, 'PathRepository.findUserRoots()');
        });
};
