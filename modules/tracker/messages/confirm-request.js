/**
 * Confirm Request message
 * @module tracker/messages/confirm-request
 */
const debug = require('debug')('bhit:message');
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Confirm Request message class
 */
class ConfirmRequest {
    /**
     * Create service
     * @param {ErrorHelper} error   Error helper service
     */
    constructor(error) {
        this._error = error;
    }

    /**
     * Service name is 'modules.tracker.messages.confirmRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.messages.confirmRequest';
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

module.exports = ConfirmRequest;