/**
 * Init Confirm message
 * @module tracker/messages/init-confirm
 */

/**
 * Init Confirm message class
 */
class InitConfirm {
    /**
     * Create service
     * @param {ErrorHelper} error   Error helper service
     */
    constructor(error) {
        this._error = error;
    }

    /**
     * Service name is 'modules.tracker.messages.initConfirm'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.messages.initConfirm';
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

module.exports = InitConfirm;