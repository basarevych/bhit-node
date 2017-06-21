/**
 * Base class for repositories
 * @module repositories/base
 */
const path = require('path');
const fs = require('fs');
const NError = require('nerror');

/**
 * Repository base class
 */
class BaseRepository {
    /**
     * Create repository
     * @param {App} app                             The application
     * @param {Postgres} postgres                   Postgres service
     * @param {Util} util                           Util service
     */
    constructor(app, postgres, util) {
        this._app = app;
        this._postgres = postgres;
        this._util = util;
    }

    /**
     * Service name is 'repositories.base'
     * @type {string}
     */
    static get provides() {
        return 'repositories.base';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'postgres', 'util' ];
    }

    /**
     * Get repository
     * @param {string} name                         Repository service name
     * @return {object}
     */
    getRepository(name) {
        return this._app.get(`repositories.${name}`);
    }

    /**
     * Get model
     * @param {string} name                         Model service name
     * @return {Object}
     */
    getModel(name) {
        return this._app.get(`models.${name}`);
    }

    /**
     * Search repository
     * @param {string} table                        Table or view name
     * @param {string[]} fields                     Fields to retrieve
     * @param {object} [options]
     * @param {string[]} [options.where]            SQL WHERE clause: will be joined with 'AND'
     * @param {Array} [options.params]              Bound parameters of WHERE (referenced as $1, $2, ... in SQL)
     * @param {string} [options.sortKey=null]       Used in ORDER BY if provided
     * @param {string} [options.sortOrder='asc']    Used in ORDER BY if provided with sort_key
     * @param {number} [options.pageSize=0]         Used in LIMIT, 0 = all records
     * @param {number} [options.pageNumber=1]       Used in OFFSET
     * @param {PostgresClient|string} [pg]          Will reuse the Postgres client provided, or if string then will
     *                                              connect to this instance of Postgres.
     * @return {Promise}                            Returns promise resolving to the following:
     * <code>
     * {
     *      totalRows: 1, // total rows in result
     *      totalPages: 1, // total number of pages
     *      pageSize: 0, // page size
     *      pageNumber: 1, // returned page number
     *      sortKey: null, // key used to sort
     *      sortOrder: 'asc', // sort order
     *      data: [ ... ], // resulting rows as array
     * }
     * </code>
     */
    search(table, fields, options = {}, pg = undefined) {
        let {
            where = [],
            params = [],
            sortKey = null,
            sortOrder = 'asc',
            pageSize = 0,
            pageNumber = 1
        } = options;

        return Promise.resolve()
            .then(() => {
                if (typeof pg === 'object')
                    return pg;

                return this._postgres.connect(pg);
            })
            .then(client => {
                return client.query(
                        'SELECT count(*)::int AS count ' +
                        `  FROM ${table} ` +
                        (where.length ? ' WHERE ' + where.join(' AND ') : ''),
                        params
                    )
                    .then(result => {
                        let totalRows = result.rowCount ? result.rows[0].count : 0;
                        let totalPages;
                        if (totalRows === 0 || pageSize === 0) {
                            totalPages = 1;
                            pageNumber = 1;
                        } else {
                            totalPages = Math.floor(totalRows / pageSize) + (totalRows % pageSize ? 1 : 0);
                            if (pageNumber > totalPages)
                                pageNumber = totalPages;
                        }

                        let offset = (pageNumber - 1) * pageSize;
                        return client.query(
                                'SELECT ' + fields.join(', ') +
                                `  FROM ${table} ` +
                                (where.length ? ' WHERE ' + where.join(' AND ') : '') +
                                (sortKey ? ` ORDER BY ${sortKey} ${sortOrder}` : '') +
                                (offset > 0 ? ` OFFSET ${offset} ` : '') +
                                (pageSize > 0 ? ` LIMIT ${pageSize} ` : ''),
                                params
                            )
                            .then(result => {
                                return {
                                    totalRows: totalRows,
                                    totalPages: totalPages,
                                    pageSize: pageSize,
                                    pageNumber: pageNumber,
                                    sortLey: sortKey,
                                    sortOrder: sortOrder,
                                    data: result.rows,
                                };
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
            .catch(error => {
                throw new NError(error, 'Repository.search()');
            });
    }

    /**
     * Load methods from given directory
     * @param {string} dir                  Directory full path
     * @throw {Error}                       Throws if couldn't load a file in the directory
     */
    _loadMethods(dir) {
        for (let name of fs.readdirSync(dir)) {
            let methodName = this._util.dashedToCamel(name.replace(/\.js$/, ''));
            let file = path.join(dir, name);
            try {
                this[methodName] = require(file).bind(this);
            } catch (error) {
                throw new NError(error, `Repository._loadMethods() - processing: ${name}`);
            }
        }
    }
}

module.exports = BaseRepository;
