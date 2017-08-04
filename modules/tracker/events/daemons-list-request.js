/**
 * Daemons List Request event
 * @module tracker/events/daemons-list-request
 */
const moment = require('moment-timezone');
const NError = require('nerror');

/**
 * Daemons List Request event class
 */
class DaemonsListRequest {
    /**
     * Create service
     * @param {App} app                                 The application
     * @param {object} config                           Configuration
     * @param {Logger} logger                           Logger service
     * @param {Registry} registry                       Registry service
     * @param {DaemonRepository} daemonRepo             Daemon repository
     */
    constructor(app, config, logger, registry, daemonRepo) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._daemonRepo = daemonRepo;
    }

    /**
     * Service name is 'modules.tracker.events.daemonsListRequest'
     * @type {string}
     */
    static get provides() {
        return 'modules.tracker.events.daemonsListRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'registry', 'repositories.daemon' ];
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

        this._logger.debug('daemons-list-request', `Got DAEMONS LIST REQUEST from ${id}`);
        return Promise.resolve()
            .then(() => {
                if (!client.daemonId)
                    return [];

                return this._daemonRepo.find(client.daemonId);
            })
            .then(daemons => {
                let daemon = daemons.length && daemons[0];
                if (!daemon) {
                    let response = this.tracker.DaemonsListResponse.create({
                        response: this.tracker.DaemonsListResponse.Result.REJECTED,
                    });
                    let reply = this.tracker.ServerMessage.create({
                        type: this.tracker.ServerMessage.Type.DAEMONS_LIST_RESPONSE,
                        messageId: message.messageId,
                        daemonsListResponse: response,
                    });
                    let data = this.tracker.ServerMessage.encode(reply).finish();
                    this._logger.debug('daemons-list-request', `Sending REJECTED DAEMONS LIST RESPONSE to ${id}`);
                    return this.tracker.send(id, data);
                }

                return this._daemonRepo.findByUser(daemon.userId)
                    .then(daemons => {
                        let list = [];
                        for (let daemon of daemons) {
                            let info;
                            for (let [ daemonId, daemonInfo ] of this._registry.daemons) {
                                if (daemonId === daemon.id) {
                                    info = daemonInfo;
                                    break;
                                }
                            }

                            if (!info || !info.clients.size) {
                                list.push(this.tracker.Daemon.create({
                                    name: daemon.name,
                                    online: false,
                                    version: '',
                                    hostname: '',
                                    externalAddress: '',
                                    internalAddresses: [],
                                }));
                                continue;
                            }

                            for (let clientId of info.clients) {
                                let clientInfo = this._registry.clients.get(clientId);
                                if (!clientInfo)
                                    continue;

                                let socketInfo = this.tracker.clients.get(clientId);

                                let internal = [];
                                for (let ip of Array.from(clientInfo.ips)) {
                                    if (internal.indexOf(ip) === -1)
                                        internal.push(ip);
                                }

                                list.push(this.tracker.Daemon.create({
                                    name: daemon.name,
                                    online: true,
                                    version: clientInfo.version || '',
                                    hostname: clientInfo.hostname || '',
                                    externalAddress: (socketInfo && socketInfo.socket.remoteAddress) || '',
                                    internalAddresses: internal,
                                }));
                            }
                        }

                        let response = this.tracker.DaemonsListResponse.create({
                            response: this.tracker.DaemonsListResponse.Result.ACCEPTED,
                            list: list,
                        });
                        let reply = this.tracker.ServerMessage.create({
                            type: this.tracker.ServerMessage.Type.DAEMONS_LIST_RESPONSE,
                            messageId: message.messageId,
                            daemonsListResponse: response,
                        });
                        let data = this.tracker.ServerMessage.encode(reply).finish();
                        this._logger.debug('daemons-list-request', `Sending ACCEPTED DAEMONS LIST RESPONSE to ${id}`);
                        this.tracker.send(id, data);
                    });
            })
            .catch(error => {
                this._logger.error(new NError(error, 'DaemonsListRequest.handle()'));
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

module.exports = DaemonsListRequest;