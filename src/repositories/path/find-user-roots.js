/**
 * PathRepository.findUserRoots()
 */
'use strict';

const NError = require('nerror');

/**
 * Find all root level nodes by user
 * @method findUserRoots
 * @memberOf module:repositories/path~PathRepository
 * @param {UserModel|number} user           User model
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = async function (user, pg) {
    let key = `sql:${this.constructor.table}-roots-by-user-id:${typeof user === 'object' ? user.id : user}`;
    let client;

    try {
        if (this._enableCache) {
            let value = await this._cacher.get(key);
            if (value)
                return this.getModel(value);
        }

        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let result = await client.query(
            `  SELECT *
                 FROM paths
                WHERE user_id = $1
                  AND parent_id IS NULL
             ORDER BY name ASC`,
            [
                typeof user === 'object' ? user.id : user,
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

        throw new NError(error, { user }, 'PathRepository.findUserRoots()');
    }
};
