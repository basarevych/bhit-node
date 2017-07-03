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

        this.tcp = null;                    // servers
        this.udp = null;

        this.clients = new Map();           // socketId -> { id: socketId, socket, wrapper }) }

        this._name = null;
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._registry = registry;
        this._timeouts = new Map();
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
        return 2 * 1000; // ms
    }

    /**
     * No data in socket timeout
     * @type {number}
     */
    static get pongTimeout() {
        return 5 * 1000; // ms
    }

    /**
     * Initialize the server
     * @param {string} name                     Config section name
     * @return {Promise}
     */
    init(name) {
        this._name = name;

        return new Promise((resolve, reject) => {
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
                        this.DetachRequest = this.proto.lookup('tracker.DetachRequest');
                        this.DetachResponse = this.proto.lookup('tracker.DetachResponse');
                        this.Tree = this.proto.lookup('tracker.Tree');
                        this.TreeRequest = this.proto.lookup('tracker.TreeRequest');
                        this.TreeResponse = this.proto.lookup('tracker.TreeResponse');
                        this.ServerConnection = this.proto.lookup('tracker.ServerConnection');
                        this.ClientConnection = this.proto.lookup('tracker.ClientConnection');
                        this.ConnectionsList = this.proto.lookup('tracker.ConnectionsList');
                        this.ConnectionsListRequest = this.proto.lookup('tracker.ConnectionsListRequest');
                        this.ConnectionsListResponse = this.proto.lookup('tracker.ConnectionsListResponse');
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
            })
            .then(() => {
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
                try {
                    if (key)
                        options.key = fs.readFileSync(key);
                } catch (error) {
                    this._logger.error(error.message);
                    process.exit(1);
                }
                try {
                    if (cert)
                        options.cert = fs.readFileSync(cert);
                } catch (error) {
                    this._logger.error(error.message);
                    process.exit(1);
                }
                try {
                    if (ca)
                        options.ca = fs.readFileSync(ca);
                } catch (error) {
                    this._logger.error(error.message);
                    process.exit(1);
                }

                return [ dgram.createSocket('udp4'), tls.createServer(options, this.onConnection.bind(this)) ];
            })
            .then(([ udpServer, tcpServer ]) => {
                udpServer.on('error', this.onUdpError.bind(this));
                udpServer.on('listening', this.onUdpListening.bind(this));
                udpServer.on('message', this.onUdpMessage.bind(this));
                this.udp = udpServer;

                tcpServer.on('error', this.onTcpError.bind(this));
                tcpServer.on('listening', this.onTcpListening.bind(this));
                this.tcp = tcpServer;
            });
    }

    /**
     * Start the server
     * @param {string} name                     Config section name
     * @return {Promise}
     */
    start(name) {
        if (name !== this._name)
            return Promise.reject(new Error(`Server ${name} was not properly bootstrapped`));

        return Array.from(this._app.get('modules')).reduce(
                (prev, [ curName, curModule ]) => {
                    return prev.then(() => {
                        if (!curModule.register)
                            return;

                        let result = curModule.register(name);
                        if (result === null || typeof result !== 'object' || typeof result.then !== 'function')
                            throw new Error(`Module '${curName}' register() did not return a Promise`);
                        return result;
                    });
                },
                Promise.resolve()
            )
            .then(() => {
                this._logger.debug('tracker', 'Starting the server');
                let port = this._normalizePort(this._config.get(`servers.${name}.port`));
                let host = (typeof port === 'string' ? undefined : this._config.get(`servers.${name}.host`));

                try {
                    this._timeoutTimer = setInterval(this._checkTimeout.bind(this), 500);

                    this.udp.bind(port, host);
                    this.tcp.listen(port, host);
                } catch (error) {
                    throw new NError(error, 'Tracker.start()');
                }
            });
    }

    /**
     * Stop the server
     * @param {string} name                     Config section name
     * @return {Promise}
     */
    stop(name) {
        if (name !== this._name)
            return Promise.reject(new Error(`Server ${name} was not properly bootstrapped`));

        this.udp.close();
        this.udp = null;

        this.tcp.close();
        this.tcp = null;

        return new Promise((resolve, reject) => {
            try {
                let port = this._normalizePort(this._config.get(`servers.${name}.port`));
                let host = this._config.get(`servers.${this._name}.host`);
                this._logger.info(`Tracker TCP/UDP servers are no longer listening on ${host}:${port}`, () => { resolve(); });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Send message
     * @param {string} id                   Client ID
     * @param {Buffer|null} data            Data to send
     */
    send(id, data) {
        let client = this.clients.get(id);
        if (!client || !client.socket || !client.wrapper)
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
        this._logger.error(msg, () => { process.exit(1); });
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
        this._logger.error(msg, () => { process.exit(1); });
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

        let client = {
            id: id,
            socket: socket,
            wrapper: new SocketWrapper(socket),
        };
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
            switch(message.type) {
                case this.ClientMessage.Type.INIT_REQUEST:
                    this.emit('init_request', id, message);
                    break;
                case this.ClientMessage.Type.CONFIRM_REQUEST:
                    this.emit('confirm_request', id, message);
                    break;
                case this.ClientMessage.Type.CREATE_DAEMON_REQUEST:
                    this.emit('create_daemon_request', id, message);
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
                case this.ClientMessage.Type.DETACH_REQUEST:
                    this.emit('detach_request', id, message);
                    break;
                case this.ClientMessage.Type.TREE_REQUEST:
                    this.emit('tree_request', id, message);
                    break;
                case this.ClientMessage.Type.CONNECTIONS_LIST_REQUEST:
                    this.emit('connections_list_request', id, message);
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
        if (error.code !== 'ECONNRESET')
            this._logger.error(`Client socket error (TCP): ${error.message} (id: ${id})`);
    }

    /**
     * Client disconnect handler
     * @param {string} id                   Client ID
     */
    onClose(id) {
        let client = this.clients.get(id);
        if (client) {
            this._logger.debug('tracker', `Client disconnected`);
            if (client.socket) {
                if (!client.socket.destroyed)
                    client.socket.destroy();
                client.socket = null;
                client.wrapper.destroy();
                client.wrapper = null;
            }
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
        this._logger.debug('tracker', `Client timeout`);
        let client = this.clients.get(id);
        if (client && client.socket) {
            client.socket.destroy();
            client.wrapper.detach();
        }
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
            if (!id)
                continue;
            if (!this.clients.has(id)) {
                this._timeouts.delete(id);
                continue;
            }

            if (timestamp.receive !== 0 && now >= timestamp.receive) {
                timestamp.receive = 0;
                timestamp.send = 0;
                this.onTimeout(id);
            } else if (timestamp.send !== 0 && now >= timestamp.send) {
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