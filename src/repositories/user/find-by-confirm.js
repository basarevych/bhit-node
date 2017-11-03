/**
 * UserRepository.findByConfirm()
 */
'use strict';

const NError = require('nerror');

/**
 * Find users by confirmation token
 * @method findByConfirm
 * @memberOf module:repositories/user~UserRepository
 * @param {string} token                    Token to search by
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = async function (token, pg) {
    let client;

    try {
        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let result = await client.query(
            `SELECT *
               FROM users
              WHERE confirm = $1`,
            [ token ]
        );
        let rows = result.rowCount ? result.rows : [];

        if (typeof pg !== 'object')
            client.done();

        return this.getModel(rows);
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { token }, 'UserRepository.findByConfirm()');
    }
};
