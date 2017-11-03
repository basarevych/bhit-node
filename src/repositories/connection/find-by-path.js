/**
 * ConnectionRepository.findByPath()
 */
'use strict';

const NError = require('nerror');

/**
 * Find connections by path
 * @method findByPath
 * @memberOf module:repositories/connection~ConnectionRepository
 * @param {PathModel|number} path           Path to search by
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = async function (path, pg) {
    let client;

    try {
        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let result = await client.query(
            `SELECT * 
               FROM connections 
              WHERE path_id = $1`,
            [ typeof path === 'object' ? path.id : path ]
        );
        let rows = result.rowCount ? result.rows : [];

        if (typeof pg !== 'object')
            client.done();

        return this.getModel(rows);
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { path }, 'ConnectionRepository.findByPath()');
    }
};
