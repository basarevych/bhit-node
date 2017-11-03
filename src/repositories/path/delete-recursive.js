/**
 * PathRepository.deleteRecursive()
 */
'use strict';

const NError = require('nerror');

/**
 * Delete a path recursively
 * @method deleteRecursive
 * @memberOf module:repositories/path~PathRepository
 * @param {PathModel|number} path           Path model or ID
 * @param {PostgresClient|string} [pg]      Will reuse the Postgres client provided, or if it is a string then will
 *                                          connect to this instance of Postgres.
 * @return {Promise}                        Resolves to number of deleted records
 */
module.exports = async function (path, pg) {
    let client;

    try {
        client = typeof pg === 'object' ? pg : await this._postgres.connect(pg || this.constructor.instance);
        let value = await client.transaction({ name: 'path_delete_recursive' }, async rollback => {
            if (typeof path !== 'object') {
                let paths = await this.find(path, client);
                path = paths.length && paths[0];
                if (!path)
                    return rollback(0);
            }

            let result = await client.query(
                `DELETE
                   FROM paths
                  WHERE id = $1`,
                [ path.id ]
            );
            let count = result.rowCount;

            let deleteEmptyParent = async parentId => {
                if (!parentId)
                    return count;

                let paths = await this.findByParent(parentId, client);
                if (paths.length)
                    return count;

                paths = await this.find(parentId, client);
                let parent = paths.length && paths[0];
                if (!parent)
                    return count;

                count += await this.delete(parent, client);
                return deleteEmptyParent(parent.parentId);
            };

            return deleteEmptyParent(path.parentId);
        });

        if (typeof pg !== 'object')
            client.done();

        return value;
    } catch (error) {
        if (client && typeof pg !== 'object')
            client.done();

        throw new NError(error, { path }, 'PathRepository.deleteRecursive()');
    }
};
