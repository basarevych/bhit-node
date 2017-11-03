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
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to array of models
 */
module.exports = async function (user, path, pg) {
    let client;

    try {
        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);

        let rows = await client.transaction({ name: 'path_find_by_user_and_path_recursive' }, async rollback => {
            let paths = await this.findByUserAndPath(user, path, client);
            if (!paths.length)
                return [];

            let load = async path => {
                let found = [ path ];
                let paths = await this.findByParent(path, client);
                for (let path of paths)
                    found = found.concat(await load(path));

                return found;
            };

            return load(paths[0]);
        });

        if (typeof pg !== 'object')
            client.done();

        return this.getModel(rows);
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { user, path }, 'PathRepository.findByUserAndPathRecursive()');
    }
};
