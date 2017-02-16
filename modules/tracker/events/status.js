/**
 * Status event
 * @module tracker/events/status
 */
const debug = require('debug')('bhit:tracker');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Status event class
 */
class Status {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {DaemonRepository} daemonRepo             Daemon repository
     */
    constructor(app, config, daemonRepo) {
        this._app = app;
        this._config = config;
        this._daemonRepo = daemonRepo;
    }

    /**
     * Service name is 'modules.tracker.events.status'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.status';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'repositories.daemon' ];
    }

    /**
     * Event handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    handle(id, message) {
        let client = this.tracker.clients.get(id);
        if (!client)
            return;

        debug(`Got STATUS from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        return Promise.resolve()
            .then(() => {
                if (!client.daemonId)
                    return [];

                return this._daemonRepo.find(client.daemonId);
            })
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon)
                    return;

                let status = client.status.get(message.status.connectionName);
                if (!status) {
                    status = {
                        connected: 0,
                    };
                    client.status.set(message.status.connectionName, status);
                }
                status.connected = message.status.connected;
            })
            .catch(error => {
                this.tracker._logger.error(new WError(error, 'Status.handle()'));
            });
    }

    /**
     * Retrieve server
     * @return {Tracker}
     */
    get tracker() {
        if (this._tracker)
            return this._tracker;
        this._tracker = this._app.get('servers').get('tracker');
        return this._tracker;
    }
}

module.exports = Status;