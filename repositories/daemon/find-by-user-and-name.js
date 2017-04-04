/**
 * DaemonRepository.findByUserAndName()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Find daemons by user and name
 * @method findByUserAndName
 * @memberOf module:repositories/daemon~DaemonRepository
 * @param {UserModel} user                  User model or ID
 * @param {string} name                     Daemon name to search by
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = function (user, name, pg) {
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
                    ' WHERE user_id = $1 AND name = $2 ',
                    [ typeof user === 'object' ? user.id : user, name ]
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
                let model = this.create();
                this._postgres.constructor.unserializeModel(model, row);
                models.push(model);
            }

            return models;
        })
        .catch(error => {
            throw new WError(error, 'DaemonRepository.findByUserAndName()');
        });
};
