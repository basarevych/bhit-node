/**
 * Init Request message
 * @module tracker/messages/init-request
 */

/**
 * Init Request message class
 */
class InitRequest {
    /**
     * Create service
     * @param {ErrorHelper} error   Error helper service
     */
    constructor(error) {
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
        return [ 'error' ];
    }

    /**
     * Message handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    onMessage(id, message) {

    }
}

module.exports = InitRequest;