/**
 * ConnectionRepository.findByPathRecursive()
 */
'use strict';

const NError = require('nerror');

/**
 * Find connections by path recursively
 * @method findByPathRecursive
 * @memberOf module:repositories/connection~ConnectionRepository
 * @param {PathModel|number} path           Path to search by
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = function (path, pg) {
    return Promise.resolve()
        .then(() => {
            if (typeof pg === 'object')
                return pg;

            return this._postgres.connect(pg);
        })
        .then(client => {
            let pathRepo = this.getRepository('path');
            let load = path => {
                let found = [];
                return client.query(
                        'SELECT * ' +
                        '  FROM connections ' +
                        ' WHERE path_id = $1 ',
                        [ typeof path === 'object' ? path.id : path ]
                    )
                    .then(result => {
                        if (result.rowCount)
                            found = found.concat(result.rows);

                        return pathRepo.findByParent(path, client)
                            .then(paths => {
                                let promises = [];
                                for (let path of paths)
                                    promises.push(load(path));

                                if (promises.length)
                                    return Promise.all(promises);
                            })
                            .then(results => {
                                for (let result of results)
                                    found = found.concat(result);

                                return found;
                            });
                    });
            };

            return client.transaction({ name: 'connection_find_by_path_recursive' }, rollback => {
                    return load(path);
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
                let model = this.getModel('connection');
                model._unserialize(row);
                models.push(model);
            }

            return models;
        })
        .catch(error => {
            throw new NError(error, { path }, 'ConnectionRepository.findByPath()');
        });
};
