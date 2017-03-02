/**
 * Status command
 * @module commands/status
 */
const debug = require('debug')('bhid:command');
const path = require('path');

/**
 * Command class
 */
class Status {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} config           Configuration
     * @param {Start} start             Start command
     */
    constructor(app, config, start) {
        this._app = app;
        this._config = config;
        this._start = start;
    }

    /**
     * Service name is 'commands.status'
     * @type {string}
     */
    static get provides() {
        return 'commands.status';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'commands.start' ];
    }

    /**
     * Run the command
     * @param {object} argv             Minimist object
     * @return {Promise}
     */
    run(argv) {
        return this._start.exec('status', [ '/var/run/bhit/daemon.pid' ])
            .then(result => {
                process.exit(result.code === 0 ? 0 : 1);
            })
            .catch(error => {
                this.error(error.message);
            })
    }

    /**
     * Log error and terminate
     * @param {...*} args
     */
    error(...args) {
        console.error(...args);
        process.exit(1);
    }
}

module.exports = Status;