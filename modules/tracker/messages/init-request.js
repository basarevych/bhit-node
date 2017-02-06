/**
 * Init Request message
 * @module tracker/messages/init-request
 */
const debug = require('debug')('bhit:message');

/**
 * Init Request message class
 */
class InitRequest {
    /**
     * Create service
     * @param {Tracker} tracker     Tracker server
     * @param {ErrorHelper} error   Error helper service
     */
    constructor(tracker, error) {
        this._tracker = tracker;
        this._error = error;
    }

    /**
     * Service name is 'modules.tracker.messages.initRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.messages.initRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'servers.tracker', 'error' ];
    }

    /**
     * Message handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    onMessage(id, message) {
        let client = this._tracker.clients.get(id);
        if (!client)
            return;

        debug(`Got INIT REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        let email = message.initRequest.email;
        let daemonName = message.initRequest.daemonName;
    }
}

module.exports = InitRequest;