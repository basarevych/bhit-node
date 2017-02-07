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
     * @param {Tracker} tracker                 Tracker server
     * @param {Logger} logger                   Logger
     * @param {UserRepository} userRepo         User repository
     * @param {DaemonRepository} daemonRepo     Daemon repository
     */
    constructor(tracker, logger, userRepo, daemonRepo) {
        this._tracker = tracker;
        this._logger = logger;
        this._userRepo = userRepo;
        this._daemonRepo = daemonRepo;
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
        return [ 'servers.tracker', 'logger', 'repositories.user', 'repositories.daemon' ];
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
        this._userRepo.findByEmail(message.initRequest.email)
            .then(users => {
                if (users.length)
                    return users[0];

                let user = this._userRepo.create();
                return this._userRepo.save(user)
                    .then(userId => {
                        if (!userId)
                            throw new Error('Could not create user');

                        return user;
                    });
            })
            .then(user => {
                return this._daemonRepo.findByUserAndName(user, message.initRequest.daemonName)
                    .then(daemons => {
                        if (daemons.length) {
                            let response = this._tracker.InitResponse.create({
                                response: this._tracker.InitResponse.Result.NAME_TAKEN,
                            });
                            let message = this.ServerMessage.create({
                                type: this.ServerMessage.Type.INIT_RESPONSE,
                                initResponse: response,
                            });
                            data = this.ServerMessage.encode(message).finish();
                            this._tracker.send(id, data);
                            return;
                        }

                        let daemon = this._daemonRepo.create();
                        daemon.token = daemon.constructor.generateToken();
                        return this._daemonRepo.save(daemon)
                            .then(daemonId => {
                                if (!daemonId)
                                    throw new Error('Could not create daemon');

                                let response = this._tracker.InitResponse.create({
                                    response: this._tracker.InitResponse.Result.VERIFY,
                                });
                                let message = this.ServerMessage.create({
                                    type: this.ServerMessage.Type.INIT_RESPONSE,
                                    initResponse: response,
                                });
                                data = this.ServerMessage.encode(message).finish();
                                this._tracker.send(id, data);
                            });
                    });
            })
            .catch(error => {
                this._logger.error(new WError(error, 'InitRequest.onMessage()'));
            });
    }
}

module.exports = InitRequest;