/**
 * Tracker server
 * @module servers/tracker
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const tls = require('tls');
const dgram = require('dgram');
const uuid = require('uuid');
const protobuf = require('protobufjs');
const EventEmitter = require('events');
const NError = require('nerror');
const SocketWrapper = require('socket-wrapper');

/**
 * Server class
 */
class Tracker extends EventEmitter {
    /**
     * Create the service
     * @param {App} app                             Application
     * @param {object} config                       Configuration
     * @param {Logger} logger                       Logger service
     * @param {Registry} registry                   Registry service
     */
    constructor(app, config, logger, registry) {
        super();

        this.tcp = null;                    // socket servers
        this.udp = null;

        this.clients = new Map();           // socketId -> TrackerClient(socketId)

        this._name = null;
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._timeouts = new Map();
        this._tcpListening = false;
        this._udpListening = false;
    }

    /**
     * Service name is 'servers.tracker'
     * @type {string}
     */
    static get provides() {
        return 'servers.tracker';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger', 'registry' ];
    }

    /**
     * Will send keep alive at this interval
     * @type {number}
     */
    static get pingTimeout() {
        return 7 * 1000; // ms
    }

    /**
     * No data in socket timeout
     * @type {number}
     */
    static get pongTimeout() {
        return 10 * 1000; // ms
    }

    /**
     * Initialize the server
     * @param {string} name                     Config section name
     * @return {Promise}
     */
    async init(name) {
        this._name = name;

        try {
            await new Promise((resolve, reject) => {
                this._logger.debug('tracker', 'Loading protocol');
                protobuf.load(path.join(this._config.base_path, 'proto', 'tracker.proto'), (error, root) => {
                    if (error)
                        return reject(new NError(error, 'Tracker.init()'));

                    try {
                        this.proto = root;
                        this.InitRequest = this.proto.lookup('tracker.InitRequest');
                        this.InitResponse = this.proto.lookup('tracker.InitResponse');
                        this.ConfirmRequest = this.proto.lookup('tracker.ConfirmRequest');
                        this.ConfirmResponse = this.proto.lookup('tracker.ConfirmResponse');
                        this.CreateDaemonRequest = this.proto.lookup('tracker.CreateDaemonRequest');
                        this.CreateDaemonResponse = this.proto.lookup('tracker.CreateDaemonResponse');
                        this.DeleteDaemonRequest = this.proto.lookup('tracker.DeleteDaemonRequest');
                        this.DeleteDaemonResponse = this.proto.lookup('tracker.DeleteDaemonResponse');
                        this.RegisterDaemonRequest = this.proto.lookup('tracker.RegisterDaemonRequest');
                        this.RegisterDaemonResponse = this.proto.lookup('tracker.RegisterDaemonResponse');
                        this.CreateRequest = this.proto.lookup('tracker.CreateRequest');
                        this.CreateResponse = this.proto.lookup('tracker.CreateResponse');
                        this.DeleteRequest = this.proto.lookup('tracker.DeleteRequest');
                        this.DeleteResponse = this.proto.lookup('tracker.DeleteResponse');
                        this.ImportRequest = this.proto.lookup('tracker.ImportRequest');
                        this.ImportResponse = this.proto.lookup('tracker.ImportResponse');
                        this.AttachRequest = this.proto.lookup('tracker.AttachRequest');
                        this.AttachResponse = this.proto.lookup('tracker.AttachResponse');
                        this.RemoteAttachRequest = this.proto.lookup('tracker.RemoteAttachRequest');
                        this.RemoteAttachResponse = this.proto.lookup('tracker.RemoteAttachResponse');
                        this.DetachRequest = this.proto.lookup('tracker.DetachRequest');
                        this.DetachResponse = this.proto.lookup('tracker.DetachResponse');
                        this.RemoteDetachRequest = this.proto.lookup('tracker.RemoteDetachRequest');
                        this.RemoteDetachResponse = this.proto.lookup('tracker.RemoteDetachResponse');
                        this.Tree = this.proto.lookup('tracker.Tree');
                        this.TreeRequest = this.proto.lookup('tracker.TreeRequest');
                        this.TreeResponse = this.proto.lookup('tracker.TreeResponse');
                        this.ServerConnection = this.proto.lookup('tracker.ServerConnection');
                        this.ClientConnection = this.proto.lookup('tracker.ClientConnection');
                        this.ConnectionsList = this.proto.lookup('tracker.ConnectionsList');
                        this.ConnectionsListRequest = this.proto.lookup('tracker.ConnectionsListRequest');
                        this.ConnectionsListResponse = this.proto.lookup('tracker.ConnectionsListResponse');
                        this.Daemon = this.proto.lookup('tracker.Daemon');
                        this.DaemonsListRequest = this.proto.lookup('tracker.DaemonsListRequest');
                        this.DaemonsListResponse = this.proto.lookup('tracker.DaemonsListResponse');
                        this.Status = this.proto.lookup('tracker.Status');
                        this.ServerAvailable = this.proto.lookup('tracker.ServerAvailable');
                        this.LookupIdentityRequest = this.proto.lookup('tracker.LookupIdentityRequest');
                        this.LookupIdentityResponse = this.proto.lookup('tracker.LookupIdentityResponse');
                        this.PunchRequest = this.proto.lookup('tracker.PunchRequest');
                        this.AddressRequest = this.proto.lookup('tracker.AddressRequest');
                        this.AddressResponse = this.proto.lookup('tracker.AddressResponse');
                        this.PeerAvailable = this.proto.lookup('tracker.PeerAvailable');
                        this.RedeemMasterRequest = this.proto.lookup('tracker.RedeemMasterRequest');
                        this.RedeemMasterResponse = this.proto.lookup('tracker.RedeemMasterResponse');
                        this.RedeemDaemonRequest = this.proto.lookup('tracker.RedeemDaemonRequest');
                        this.RedeemDaemonResponse = this.proto.lookup('tracker.RedeemDaemonResponse');
                        this.RedeemPathRequest = this.proto.lookup('tracker.RedeemPathRequest');
                        this.RedeemPathResponse = this.proto.lookup('tracker.RedeemPathResponse');
                        this.ClientMessage = this.proto.lookup('tracker.ClientMessage');
                        this.ServerMessage = this.proto.lookup('tracker.ServerMessage');
                        resolve();
                    } catch (error) {
                        reject(new NError(error, 'Tracker.init()'));
                    }
                });
            });

            let configPath = (os.platform() === 'freebsd' ? '/usr/local/etc/bhit' : '/etc/bhit');
            let key = this._config.get(`servers.${name}.ssl.key`);
            if (key && key[0] !== '/')
                key = path.join(configPath, 'certs', key);
            let cert = this._config.get(`servers.${name}.ssl.cert`);
            if (cert && cert[0] !== '/')
                cert = path.join(configPath, 'certs', cert);
            let ca = this._config.get(`server.${name}.ssl.ca`);
            if (ca && ca[0] !== '/')
                ca = path.join(configPath, 'certs', ca);

            let options = {};
            if (key)
                options.key = fs.readFileSync(key);
            if (cert)
                options.cert = fs.readFileSync(cert);
            if (ca)
                options.ca = fs.readFileSync(ca);

            this.udp = dgram.createSocket('udp4');
            this.udp.on('error', this.onUdpError.bind(this));
            this.udp.on('listening', this.onUdpListening.bind(this));
            this.udp.on('message', this.onUdpMessage.bind(this));

            this.tcp = tls.createServer(options, this.onConnection.bind(this));
            this.tcp.on('error', this.onTcpError.bind(this));
            this.tcp.on('listening', this.onTcpListening.bind(this));
        } catch (error) {
            return this._app.exit(
                this._app.constructor.fatalExitCode,
                error.messages || error.message
            );
        }
    }

    /**
     * Start the server
     * @param {string} name                     Config section name
     * @return {Promise}
     */
    async start(name) {
        if (name !== this._name)
            throw new Error(`Server ${name} was not properly initialized`);

        try {
            await Array.from(this._app.get('modules')).reduce(
                async (prev, [curName, curModule]) => {
                    await prev;

                    if (!curModule.register)
                        return;

                    let result = curModule.register(name);
                    if (result === null || typeof result !== 'object' || typeof result.then !== 'function')
                        throw new Error(`Module '${curName}' register() did not return a Promise`);
                    return result;
                },
                Promise.resolve()
            );

            this._logger.debug('tracker', 'Starting the server');
            await new Promise((resolve, reject) => {
                let counter = 0;

                function done() {
                    if (++counter === 2)
                        resolve();
                }

                try {
                    let port = this._normalizePort(this._config.get(`servers.${name}.port`));
                    let host = (typeof port === 'string' ? undefined : this._config.get(`servers.${name}.host`));

                    this.udp.once('listening', () => { this._udpListening = true; done(); });
                    this.udp.bind(port, host);

                    this.tcp.once('listening', () => { this._tcpListening = true; done(); });
                    this.tcp.listen(port, host);
                } catch (error) {
                    reject(error);
                }
            });

            this._timeoutTimer = setInterval(this._checkTimeout.bind(this), 500);
        } catch (error) {
            return this._app.exit(
                this._app.constructor.fatalExitCode,
                error.messages || error.message
            );
        }
    }

    /**
     * Stop the server
     * @param {string} name                     Config section name
     * @return {Promise}
     */
    async stop(name) {
        if (name !== this._name)
            throw new Error(`Server ${name} was not properly initialized`);

        try {
            if (this._timeoutTimer) {
                clearInterval(this._timeoutTimer);
                this._timeoutTimer = null;
            }

            await new Promise(resolve => {
                let counter = 0;
                let goal = 0;
                if (this._tcpListening)
                    goal++;
                if (this._udpListening)
                    goal++;

                let done = () => {
                    if (++counter >= goal) {
                        if (goal)
                            this._logger.info('Tracker TCP/UDP servers are no longer listening', resolve);
                        else
                            resolve();
                    }
                };

                if (!goal)
                    return done();

                if (this._udpListening) {
                    this.udp.once('close', () => {
                        this._udpListening = false;
                        done();
                    });
                    this.udp.close();
                }

                if (this._tcpListening) {
                    this.tcp.once('close', () => {
                        this._udpListening = false;
                        done();
                    });
                    this.tcp.close();
                }
            });
        } catch (error) {
            return this._app.exit(
                this._app.constructor.fatalExitCode,
                error.messages || error.message
            );
        }
    }

    /**
     * Send message
     * @param {string} id                   Client ID
     * @param {Buffer|null} data            Data to send
     */
    send(id, data) {
        let client = this.clients.get(id);
        if (!client)
            return;

        if (!data) {
            try {
                let message = this.ServerMessage.create({
                    type: this.ServerMessage.Type.ALIVE,
                });
                data = this.ServerMessage.encode(message).finish();
            } catch (error) {
                this._logger.error(new NError(error, `Tracker.send()`));
                return;
            }
        }

        client.wrapper.send(data);
    }

    /**
     * UDP Error handler
     * @param {object} error            The error
     */
    onUdpError(error) {
        if (error.syscall !== 'listen')
            return this._logger.error(new NError(error, 'Tracker.onUdpError()'));

        let msg;
        switch (error.code) {
            case 'EACCES':
                msg = 'Could not bind to tracker UDP port';
                break;
            case 'EADDRINUSE':
                msg = 'Tracker UDP port is already in use';
                break;
            default:
                msg = error;
        }
        return this._app.exit(this._app.constructor.fatalExitCode, msg);
    }

    /**
     * TCP Error handler
     * @param {object} error            The error
     */
    onTcpError(error) {
        if (error.syscall !== 'listen')
            return this._logger.error(new NError(error, 'Tracker.onTcpError()'));

        let msg;
        switch (error.code) {
            case 'EACCES':
                msg = 'Could not bind to tracker TCP port';
                break;
            case 'EADDRINUSE':
                msg = 'Tracker TCP port is already in use';
                break;
            default:
                msg = error;
        }
        return this._app.exit(this._app.constructor.fatalExitCode, msg);
    }

    /**
     * UDP listening event handler
     */
    onUdpListening() {
        let port = this._normalizePort(this._config.get(`servers.${this._name}.port`));
        let host = this._config.get(`servers.${this._name}.host`);
        this._logger.info(`Tracker UDP server listening on ${host}:${port}`);
    }

    /**
     * TCP listening event handler
     */
    onTcpListening() {
        let port = this._normalizePort(this._config.get(`servers.${this._name}.port`));
        let host = this._config.get(`servers.${this._name}.host`);
        this._logger.info(`Tracker TCP server listening on ${host}:${port}`);
    }

    /**
     * Connection handler
     * @param {object} socket           Client socket
     */
    onConnection(socket) {
        let id = uuid.v1();
        this._logger.debug('tracker', `New socket from ${socket.remoteAddress}:${socket.remotePort}`);

        let client = this._app.get('entities.trackerClient', id);
        client.socket = socket;
        client.wrapper = new SocketWrapper(socket);

        this.clients.set(id, client);
        this._registry.addClient(id);

        this._timeouts.set(
            id,
            {
                send: Date.now() + this.constructor.pingTimeout,
                receive: Date.now() + this.constructor.pongTimeout,
            }
        );

        client.wrapper.on(
            'receive',
            data => {
                if (!this.onMessage(id, data)) {
                    client.socket.end();
                    client.wrapper.detach();
                }
            }
        );
        client.wrapper.on(
            'read',
            data => {
                let timeout = this._timeouts.get(id);
                if (timeout)
                    timeout.receive = Date.now() + this.constructor.pongTimeout;
            }
        );
        client.wrapper.on(
            'flush',
            data => {
                let timeout = this._timeouts.get(id);
                if (timeout)
                    timeout.send = Date.now() + this.constructor.pingTimeout;
            }
        );

        socket.on('error', error => { this.onError(id, error); });
        socket.on('close', () => { this.onClose(id); });
        socket.on('end', () => { client.wrapper.detach(); });
        socket.on('timeout', () => { this.onTimeout(id); });

        this.emit('connection', id);
    }

    /**
     * Client message handler
     * @param {string} id               Client ID
     * @param {Buffer} data             Message
     * @return {boolean}                Destroy socket on false
     */
    onMessage(id, data) {
        let client = this.clients.get(id);
        if (!client)
            return false;

        if (!data || !data.length)
            return true;

        let message;
        try {
            message = this.ClientMessage.decode(data);
            if (message.type === this.ClientMessage.Type.ALIVE)
                return true;
        } catch (error) {
            this._logger.error(`Client protocol error (TCP): ${error.message}`);
            return false;
        }

        try {
            this._logger.debug('tracker', `Client message ${message.type} from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
            switch (message.type) {
                case this.ClientMessage.Type.INIT_REQUEST:
                    this.emit('init_request', id, message);
                    break;
                case this.ClientMessage.Type.CONFIRM_REQUEST:
                    this.emit('confirm_request', id, message);
                    break;
                case this.ClientMessage.Type.CREATE_DAEMON_REQUEST:
                    this.emit('create_daemon_request', id, message);
                    break;
                case this.ClientMessage.Type.DELETE_DAEMON_REQUEST:
                    this.emit('delete_daemon_request', id, message);
                    break;
                case this.ClientMessage.Type.REGISTER_DAEMON_REQUEST:
                    this.emit('register_daemon_request', id, message);
                    break;
                case this.ClientMessage.Type.CREATE_REQUEST:
                    this.emit('create_request', id, message);
                    break;
                case this.ClientMessage.Type.DELETE_REQUEST:
                    this.emit('delete_request', id, message);
                    break;
                case this.ClientMessage.Type.IMPORT_REQUEST:
                    this.emit('import_request', id, message);
                    break;
                case this.ClientMessage.Type.ATTACH_REQUEST:
                    this.emit('attach_request', id, message);
                    break;
                case this.ClientMessage.Type.REMOTE_ATTACH_REQUEST:
                    this.emit('remote_attach_request', id, message);
                    break;
                case this.ClientMessage.Type.DETACH_REQUEST:
                    this.emit('detach_request', id, message);
                    break;
                case this.ClientMessage.Type.REMOTE_DETACH_REQUEST:
                    this.emit('remote_detach_request', id, message);
                    break;
                case this.ClientMessage.Type.TREE_REQUEST:
                    this.emit('tree_request', id, message);
                    break;
                case this.ClientMessage.Type.CONNECTIONS_LIST_REQUEST:
                    this.emit('connections_list_request', id, message);
                    break;
                case this.ClientMessage.Type.DAEMONS_LIST_REQUEST:
                    this.emit('daemons_list_request', id, message);
                    break;
                case this.ClientMessage.Type.STATUS:
                    this.emit('status', id, message);
                    break;
                case this.ClientMessage.Type.LOOKUP_IDENTITY_REQUEST:
                    this.emit('lookup_identity_request', id, message);
                    break;
                case this.ClientMessage.Type.PUNCH_REQUEST:
                    this.emit('punch_request', id, message);
                    break;
                case this.ClientMessage.Type.REDEEM_MASTER_REQUEST:
                    this.emit('redeem_master_request', id, message);
                    break;
                case this.ClientMessage.Type.REDEEM_DAEMON_REQUEST:
                    this.emit('redeem_daemon_request', id, message);
                    break;
                case this.ClientMessage.Type.REDEEM_PATH_REQUEST:
                    this.emit('redeem_path_request', id, message);
                    break;
            }
        } catch (error) {
            this._logger.error(new NError(error, 'Tracker.onMessage()'));
        }

        return true;
    }

    /**
     * Client error handler
     * @param {string} id                   Client ID
     * @param {Error} error                 Error
     */
    onError(id, error) {
        let client = this.clients.get(id);
        if (!client)
            return;

        if (error.code !== 'ECONNRESET')
            this._logger.error(`Client socket error (TCP, ${client.socket.remoteAddress}:${client.socket.remotePort}): ${error.fullStack || error.stack}`);
    }

    /**
     * Client disconnect handler
     * @param {string} id                   Client ID
     */
    onClose(id) {
        let client = this.clients.get(id);
        if (client) {
            this._logger.debug('tracker', `Client disconnected ${client.socket.remoteAddress}:${client.socket.remotePort}`);
            client.socket.destroy();
            client.wrapper.destroy();
            this.clients.delete(id);
        }

        this._timeouts.delete(id);
        this._registry.removeClient(id);
    }

    /**
     * Client timeout handler
     * @param {string} id                   Client ID
     */
    onTimeout(id) {
        let client = this.clients.get(id);
        if (!client)
            return;

        this._logger.debug('tracker', `Client timeout ${client.socket.remoteAddress}:${client.socket.remotePort}`);
        this.onClose(id);
    }

    /**
     * UDP message from client
     * @param {Buffer} data                 The message
     * @param {object} info                 Info
     */
    onUdpMessage(data, info) {
        this._logger.debug('tracker', `Got UDP message from ${info.address}:${info.port}`);

        if (!data.length)
            return;

        let message;
        try {
            message = this.ClientMessage.decode(data);
        } catch (error) {
            this._logger.error(`Client protocol error (UDP): ${error.message}`);
            return;
        }

        try {
            switch (message.type) {
                case this.ClientMessage.Type.ADDRESS_RESPONSE:
                    this.emit('address_response', info, message);
                    break;
            }
        } catch (error) {
            this._logger.error(new NError(error, 'Tracker.onUdpMessage()'));
        }
    }

    /**
     * Check socket timeout
     */
    _checkTimeout() {
        let now = Date.now();
        for (let [ id, timestamp ] of this._timeouts) {
            if (!this.clients.has(id)) {
                this._timeouts.delete(id);
                continue;
            }

            if (timestamp.receive !== 0 && now >= timestamp.receive) {
                timestamp.receive = 0;
                this.onTimeout(id);
                continue;
            }

            if (timestamp.send !== 0 && now >= timestamp.send) {
                timestamp.send = 0;
                this.send(id, null);
            }
        }
    }

    /**
     * Normalize port parameter
     * @param {string|number} val           Port value
     * @return {*}
     */
    _normalizePort(val) {
        let port = parseInt(val, 10);
        if (!port || isNaN(port))
            throw new Error(`Invalid port in config: ${val}`);
        return port;
    }
}

module.exports = Tracker;
