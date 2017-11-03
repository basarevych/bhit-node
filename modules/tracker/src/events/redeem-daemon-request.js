/**
 * Redeem Daemon Request event
 * @module tracker/events/redeem-daemon-request
 */
const NError = require('nerror');

/**
 * Redeem Daemon Request event class
 */
class RedeemDaemonRequest {
    /**
     * Create service
     * @param {App} app                                         The application
     * @param {object} config                                   Configuration
     * @param {Logger} logger                                   Logger service
     * @param {Util} util                                       Util service
     * @param {Registry} registry                               Registry service
     * @param {UserRepository} userRepo                         User repository
     * @param {DaemonRepository} daemonRepo                     Daemon repository
     * @param {RegisterDaemonRequest} registerDaemonRequest     RegisterDaemonRequest event
     */
    constructor(app, config, logger, util, registry, userRepo, daemonRepo, registerDaemonRequest) {
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._util = util;
        this._registry = registry;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
        this._registerDaemonRequest = registerDaemonRequest;
    }

    /**
     * Service name is 'tracker.events.redeemDaemonRequest'
     * @type {string}
     */
    static get provides() {
        return 'tracker.events.redeemDaemonRequest';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [
            'app',
            'config',
            'logger',
            'util',
            'registry',
            'repositories.user',
            'repositories.daemon',
            'tracker.events.registerDaemonRequest'
        ];
    }

    /**
     * Event handler
     * @param {string} id           ID of the client
     * @param {object} message      The message
     */
    async handle(id, message) {
        let client = this._registry.clients.get(id);
        if (!client)
            return;

        this._logger.debug('redeem-daemon-request', `Got REDEEM DAEMON REQUEST from ${id}`);
        try {
            let users = await this._userRepo.findByToken(message.redeemDaemonRequest.token);
            let user = users.length && users[0];
            if (!user) {
                let response = this.tracker.RedeemDaemonResponse.create({
                    response: this.tracker.RedeemDaemonResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.REDEEM_DAEMON_RESPONSE,
                    messageId: message.messageId,
                    redeemDaemonResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('redeem-daemon-request', `Sending REJECTED REDEEM DAEMON RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let daemons = await this._daemonRepo.findByUserAndName(user, message.redeemDaemonRequest.daemonName);
            let daemon = daemons.length && daemons[0];
            if (!daemon) {
                let response = this.tracker.RedeemDaemonResponse.create({
                    response: this.tracker.RedeemDaemonResponse.Result.REJECTED,
                });
                let reply = this.tracker.ServerMessage.create({
                    type: this.tracker.ServerMessage.Type.REDEEM_DAEMON_RESPONSE,
                    messageId: message.messageId,
                    redeemDaemonResponse: response,
                });
                let data = this.tracker.ServerMessage.encode(reply).finish();
                this._logger.debug('redeem-daemon-request', `Sending REJECTED REDEEM DAEMON RESPONSE to ${id}`);
                return this.tracker.send(id, data);
            }

            let info = this._registry.daemons.get(daemon.id);
            let clients = info ? Array.from(info.clients) : [];

            daemon.token = this._daemonRepo.generateToken();
            await this._daemonRepo.save(daemon);

            let response = this.tracker.RedeemDaemonResponse.create({
                response: this.tracker.RedeemDaemonResponse.Result.ACCEPTED,
                token: daemon.token,
            });
            let reply = this.tracker.ServerMessage.create({
                type: this.tracker.ServerMessage.Type.REDEEM_DAEMON_RESPONSE,
                messageId: message.messageId,
                redeemDaemonResponse: response,
            });
            let data = this.tracker.ServerMessage.encode(reply).finish();
            this._logger.debug('redeem-daemon-request', `Sending ACCEPTED REDEEM DAEMON RESPONSE to ${id}`);
            this.tracker.send(id, data);

            let promises = [];
            for (let clientId of clients)
                promises.push(this._registerDaemonRequest.sendConnectionsList(clientId, true));
            await Promise.all(promises);

            for (let clientId of clients) {
                let info = this.tracker.clients.get(clientId);
                if (info) {
                    info.socket.end();
                    info.wrapper.detach();
                }
            }
        } catch (error) {
            this._logger.error(new NError(error, 'RedeemDaemonRequest.handle()'));
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

module.exports = RedeemDaemonRequest;
