/**
 * Lookup Identity Request event
 * @module tracker/events/lookup-identity-request
 */
const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Lookup Identity Request event class
 */
class LookupIdentityRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     */
    constructor(app, config, logger) {
        this._app = app;
        this._config = config;
        this._logger = logger;
    }

    /**
     * Service name is 'modules.tracker.events.lookupIdentityRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.lookupIdentityRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger' ];
    }

    /**
     * Event handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    handle(id, message) {
        let client = this.tracker.clients.get(id);
        if (!client || !client.daemonId)
            return;

        this._logger.debug('lookup-identity-request', `Got LOOKUP IDENTITY REQUEST from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        try {
            let info = this.tracker.identities.get(message.lookupIdentityRequest.identity);
            if (info && info.clients.size) {
                let iter = info.clients.values();
                let found = iter.next().value;
                info = this.tracker.clients.get(found);
            } else {
                info = null;
            }
            if (!info) {
                let response = this.tracker.LookupIdentityResponse.create({
                    response: this.tracker.LookupIdentityResponse.Result.NOT_FOUND,
                });
                let msg = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.LOOKUP_IDENTITY_RESPONSE,
                    messageId: message.messageId,
                    lookupIdentityResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(msg).finish();
                this._logger.debug('lookup-identity-request', `Sending LOOKUP IDENTITY RESPONSE to ${info.socket.remoteAddress}:${info.socket.remotePort}`);
                return this.tracker.send(id, data);
            }

            let response = this.tracker.LookupIdentityResponse.create({
                response: this.tracker.LookupIdentityResponse.Result.FOUND,
                name: info.daemonName,
                key: info.key,
            });
            let msg = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.LOOKUP_IDENTITY_RESPONSE,
                messageId: message.messageId,
                lookupIdentityResponse: response,
            });
            let data = this.tracker.ServerMessage.encode(msg).finish();
            this._logger.debug('lookup-identity-request', `Sending LOOKUP IDENTITY RESPONSE to ${info.socket.remoteAddress}:${info.socket.remotePort}`);
            return this.tracker.send(id, data);
        } catch (error) {
            this._logger.error(new WError(error, 'LookupIdentityRequest.handle()'));
        }
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

module.exports = LookupIdentityRequest;