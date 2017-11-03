/**
 * DaemonRepository.findByUser()
 */
'use strict';

const NError = require('nerror');

/**
 * Find daemons by user
 * @method findByUser
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {UserModel} user                  User model or ID
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = async function (user, pg) {
    let client;

    try {
        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let result = await client.query(
            `SELECT *
               FROM daemons
              WHERE user_id = $1`,
            [ typeof user === 'object' ? user.id : user ]
        );
        let rows = result.rowCount ? result.rows : [];

        if (typeof pg !== 'object')
            client.done();

        return this.getModel(rows);
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { user }, 'DaemonRepository.findByUser()');
    }
};
