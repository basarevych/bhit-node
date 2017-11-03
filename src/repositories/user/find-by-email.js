/**
 * UserRepository.findByEmail()
 */
'use strict';

const NError = require('nerror');

/**
 * Find users by email
 * @method findByEmail
 * @memberOf module:repositories/user~UserRepository
 * @param {string} email                    Email to search by
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = async function (email, pg) {
    let key = `sql:${this.constructor.table}-by-email:${email}`;
    let client;

    try {
        if (this._enableCache) {
            let value = await this._cacher.get(key);
            if (value)
                return this.getModel(value);
        }

        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let result = await client.query(
            `SELECT *
               FROM users
              WHERE email = $1`,
            [ email ]
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

        throw new NError(error, { email }, 'UserRepository.findByEmail()');
    }
};
