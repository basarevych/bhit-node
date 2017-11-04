/**
 * Lookup Identity Request event
 * @module tracker/events/lookup-identity-request
 */
const NError = require('nerror');
const Base = require('./base');

/**
 * Lookup Identity Request event class
 */
class LookupIdentityRequest extends Base {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {Registry} registry                       Registry service
     */
    constructor(app, config, logger, registry) {
        super(app);
        this._config = config;
        this._logger = logger;
        this._registry = registry;
    }

    /**
     * Service name is 'tracker.events.lookupIdentityRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.lookupIdentityRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'registry' ];
    }

    /**
     * Event name
     * @type {string}
     */
    get name() {
        return 'lookup_identity_request';
    }

    /**
     * Event handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    handle(id, message) {
        let client = this._registry.clients.get(id);
        if (!client)
            return;

        this._logger.debug('lookup-identity-request', `Got LOOKUP IDENTITY REQUEST from ${id}`);
        try {
            if (!client.daemonId) {
                let response = this.tracker.LookupIdentityResponse.create({
                    response: this.tracker.LookupIdentityResponse.Result.REJECTED,
                });
                let msg = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.LOOKUP_IDENTITY_RESPONSE,
                    messageId: message.messageId,
                    lookupIdentityResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(msg).finish();
                this._logger.debug('lookup-identity-request', `Sending REJECTED LOOKUP IDENTITY RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let info, daemon;
            let identity = this._registry.identities.get(message.lookupIdentityRequest.identity);
            if (identity && identity.clients.size) {
                let iter = identity.clients.values();
                let found = iter.next().value;
                info = this._registry.clients.get(found);
                if (info && info.daemonId)
                    daemon = this._registry.daemons.get(info.daemonId);
            }

            if (!info || !daemon) {
                let response = this.tracker.LookupIdentityResponse.create({
                    response: this.tracker.LookupIdentityResponse.Result.NOT_FOUND,
                });
                let msg = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.LOOKUP_IDENTITY_RESPONSE,
                    messageId: message.messageId,
                    lookupIdentityResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(msg).finish();
                this._logger.debug('lookup-identity-request', `Sending NOT_FOUND LOOKUP IDENTITY RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let response = this.tracker.LookupIdentityResponse.create({
                response: this.tracker.LookupIdentityResponse.Result.FOUND,
                name: daemon.userEmail + '?' + daemon.name,
                key: info.key,
            });
            let msg = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.LOOKUP_IDENTITY_RESPONSE,
                messageId: message.messageId,
                lookupIdentityResponse: response,
            });
            let data = this.tracker.ServerMessage.encode(msg).finish();
            this._logger.debug('lookup-identity-request', `Sending FOUND LOOKUP IDENTITY RESPONSE to ${id}`);
            this.tracker.send(id, data);
        } catch (error) {
            this._logger.error(new NError(error, 'LookupIdentityRequest.handle()'));
        }
    }
}

module.exports = LookupIdentityRequest;
