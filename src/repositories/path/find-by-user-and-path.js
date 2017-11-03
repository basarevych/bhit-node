/**
 * PathRepository.findByUserAndPath()
 */
'use strict';

const NError = require('nerror');

/**
 * Find paths by user and path
 * @method findByUserAndPath
 * @memberOf module:repositories/path~PathRepository
 * @param {UserModel|number} user           User model
 * @param {string} path                     Path to search by
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = async function (user, path, pg) {
    let key = `sql:${this.constructor.table}-by-user-id-and-path:${typeof user === 'object' ? user.id : user}:${path}`;
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
               FROM paths
              WHERE user_id = $1 AND path = $2`,
            [
                typeof user === 'object' ? user.id : user,
                path
            ]
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

        throw new NError(error, { user, path }, 'PathRepository.findByUserAndPath()');
    }
};
