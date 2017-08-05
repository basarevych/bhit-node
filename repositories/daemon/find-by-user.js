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
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = function (user, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg === 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            return client.query(
                    'SELECT * ' +
                    '  FROM daemons ' +
                    ' WHERE user_id = $1 ',
                    [ typeof user === 'object' ? user.id : user ]
                )
                .then(result => {
                    return result.rowCount ? result.rows : [];
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
        .then(rows => {
            let models = [];
            for (let row of rows) {
                let model = this.getModel('daemon');
                model._unserialize(row);
                models.push(model);
            }

            return models;
        })
        .catch(error => {
            throw new NError(error, { user }, 'DaemonRepository.findByUser()');
        });
};
