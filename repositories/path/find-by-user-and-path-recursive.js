/**
 * PathRepository.findByUserAndPathRecursive()
 */
'use strict';

const NError = require('nerror');

/**
 * Find paths by user and path recursively
 * @method findByUserAndPathRecursive
 * @memberOf module:repositories/path~PathRepository
 * @param {UserModel|number} user           User model
 * @param {string} path                     Path to search by
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if string then will connect to
 *                                          this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = function (user, path, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg === 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            let load = path => {
                let found = [ path ];
                return this.findByParent(path, client)
                    .then(paths => {
                        let promises = [];
                        for (let path of paths)
                            promises.push(load(path));

                        if (promises.length)
                            return Promise.all(promises);
                        else
                            return [];
                    })
                    .then(results => {
                        for (let result of results)
                            found = found.concat(result);

                        return found;
                    });
            };

            return client.transaction({ name: 'path_find_by_user_and_path_recursive' }, rollback => {
                    return this.findByUserAndPath(user, path)
                        .then(paths => {
                            if (!paths.length)
                                return [];

                            return load(paths[0]);
                        });
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
                let model = this.getModel('path');
                model._unserialize(row);
                models.push(model);
            }

            return models;
        })
        .catch(error => {
            throw new NError(error, { user, path }, 'PathRepository.findByUserAndPathRecursive()');
        });
};
