/**
 * ConnectionRepository.findByToken()
 */
'use strict';

const NError = require('nerror');

/**
 * Find connections by token
 * @method findByToken
 * @memberOf module:repositories/connection~ConnectionRepository
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
               FROM connections 
              WHERE token = $1`,
            [ token ]
        );
        let rows = result.rowCount ? result.rows : [];

        if (typeof pg !== 'object')
            client.done();

        return this.getModel(rows);
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { token }, 'ConnectionRepository.findByToken()');
    }
};
