/**
 * Tracker server
 * @module servers/tracker
 */
const debug = require('debug')('bhit:tracker');
const path = require('path');
const fs = require('fs');
const tls = require('tls');
const dgram = require('dgram');
const uuid = require('uuid');
const protobuf = require('protobufjs');
const EventEmitter = require('events');
const WError = require('verror').WError;
const SocketWrapper = require('socket-wrapper');

/**
 * Server class
 */
class Tracker extends EventEmitter {
    /**
     * Create the service
     * @param {App} app                     Application
     * @param {object} config               Configuration
     * @param {Logger} logger               Logger service
     * @param {Util} util                   Util service
     */
    constructor(app, config, logger, util) {
        super();

        this.clients = new Map();

        this._name = null;
        this._app = app;
        this._config = config;
        this._logger = logger;
        this._util = util;
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
        return [ 'app', 'config', 'logger', 'util' ];
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
        this._logger.setLogStream('tracker.log', this._config.get(`servers.${name}.log`));

        return new Promise((resolve, reject) => {
                debug('Loading protocol');
                protobuf.load(path.join(this._config.base_path, 'proto', 'tracker.proto'), (error, root) => {
                    if (error)
                        return reject(new WError(error, 'Tracker.init()'));

                    try {
                        this.proto = root;
                        this.InitRequest = this.proto.lookup('tracker.InitRequest');
                        this.InitResponse = this.proto.lookup('tracker.InitResponse');
                        this.ConfirmRequest = this.proto.lookup('tracker.ConfirmRequest');
                        this.ConfirmResponse = this.proto.lookup('tracker.ConfirmResponse');
                        this.ClientMessage = this.proto.lookup('tracker.ClientMessage');
                        this.ServerMessage = this.proto.lookup('tracker.ServerMessage');
                        resolve();
                    } catch (error) {
                        reject(new WError(error, 'Tracker.init()'));
                    }
                })
            })
            .then(() => {
                let key = this._config.get(`servers.${name}.ssl.key`);
                if (key && key[0] != '/')
                    key = path.join(this._config.base_path, key);
                let cert = this._config.get(`servers.${name}.ssl.cert`);
                if (cert && cert[0] != '/')
                    cert = path.join(this._config.base_path, cert);
                let ca = this._config.get(`server.${name}.ssl.ca`);
                if (ca && ca[0] != '/')
                    ca = path.join(this._config.base_path, ca);

                let options = {
                    key: fs.readFileSync(key),
                    cert: fs.readFileSync(cert),
                };
                if (ca)
                    options.ca = fs.readFileSync(ca);

                return [ dgram.createSocket('udp4'), tls.createServer(options, this.onConnection.bind(this)) ];
            })
            .then(([ udpServer, tcpServer ]) => {
                udpServer.on('error', this.onUdpError.bind(this));
                udpServer.on('listening', this.onUdpListening.bind(this));
                udpServer.on('message', this.onUdpMessage.bind(this));
                this._app.registerInstance(udpServer, 'udp');

                tcpServer.on('error', this.onTcpError.bind(this));
                tcpServer.on('listening', this.onTcpListening.bind(this));
                this._app.registerInstance(tcpServer, 'tcp');

                this._app.registerInstance(this.clients, 'clients');
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
                        if (result === null || typeof result != 'object' || typeof result.then != 'function')
                            throw new Error(`Module '${curName}' register() did not return a Promise`);
                        return result;
                    });
                },
                Promise.resolve()
            )
            .then(() => {
                debug('Starting the server');
                let port = this._normalizePort(this._config.get(`servers.${this._name}.port`));
                let host = (typeof port == 'string' ? undefined : this._config.get(`servers.${this._name}.host`));
                let udpServer = this._app.get('udp');
                let tcpServer = this._app.get('tcp');


                debug('Initiating tracker sockets');
                try {
                    this._timeoutTimer = setInterval(() => { this._checkTimeout(); }, 500);

                    udpServer.bind(port, host);
                    tcpServer.listen(port, host);
                } catch (error) {
                    throw new WError(error, 'Tracker.start()');
                }
            });
    }

    /**
     * Generate daemon token
     * @return {string}
     */
    generateToken() {
        return this._util.getRandomString(32, { lower: true, upper: true, digits: true });
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
                this._logger.error(new WError(error, `Tracker.send()`));
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
            return this._logger.error(new WError(error, 'Tracker.onUdpError()'));

        switch (error.code) {
            case 'EACCES':
                this._logger.error('Tracker UDP port requires elevated privileges');
                break;
            case 'EADDRINUSE':
                this._logger.error('Tracker UDP port is already in use');
                break;
            default:
                this._logger.error(error);
        }
        process.exit(1);
    }

    /**
     * TCP Error handler
     * @param {object} error            The error
     */
    onTcpError(error) {
        if (error.syscall !== 'listen')
            return this._logger.error(new WError(error, 'Tracker.onTcpError()'));

        switch (error.code) {
            case 'EACCES':
                this._logger.error('Tracker TCP port requires elevated privileges');
                break;
            case 'EADDRINUSE':
                this._logger.error('Tracker TCP port is already in use');
                break;
            default:
                this._logger.error(error);
        }
        process.exit(1);
    }

    /**
     * UDP listening event handler
     */
    onUdpListening() {
        let port = this._normalizePort(this._config.get(`servers.${this._name}.port`));
        this._logger.info(
            'Tracker UDP server listening on ' +
            (typeof port == 'string' ?
                port :
                this._config.get(`servers.${this._name}.host`) + ':' + port)
        );
    }

    /**
     * TCP listening event handler
     */
    onTcpListening() {
        let port = this._normalizePort(this._config.get(`servers.${this._name}.port`));
        this._logger.info(
            'Tracker TCP server listening on ' +
            (typeof port == 'string' ?
                port :
                this._config.get(`servers.${this._name}.host`) + ':' + port)
        );
    }

    /**
     * Connection handler
     * @param {object} socket           Client socket
     */
    onConnection(socket) {
        let id = uuid.v1();
        debug(`New socket from ${socket.remoteAddress}:${socket.remotePort}`);

        let client = {
            id: id,
            socket: socket,
            wrapper: new SocketWrapper(socket),
        };
        this.clients.set(id, client);

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
                    socket.end();
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

        try {
            let message = this.ClientMessage.decode(data);
            if (message.type === this.ClientMessage.Type.ALIVE)
                return true;

            debug(`Client message ${message.type} from ${client.socket.remoteAddress}:${client.socket.remotePort}`);
            switch(message.type) {
                case this.ClientMessage.Type.INIT_REQUEST:
                    this.emit('init_request', id, message);
                    break;
                case this.ClientMessage.Type.CONFIRM_REQUEST:
                    this.emit('confirm_request', id, message);
                    break;
            }
        } catch (error) {
            this._logger.error(`Client protocol error (TCP): ${error.message}`);
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
            this._logger.error(`Client socket error (TCP): ${error.message}`);
    }

    /**
     * Client disconnect handler
     * @param {string} id                   Client ID
     */
    onClose(id) {
        let client = this.clients.get(id);
        if (client) {
            debug(`Client disconnected`);
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
    }

    /**
     * Client timeout handler
     * @param {string} id                   Client ID
     */
    onTimeout(id) {
        debug(`Client timeout`);
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
        debug(`Got UDP message from ${info.address}:${info.port}`);

        if (!data.length)
            return;

        try {
            let message = this.ClientMessage.decode(data);
        } catch (error) {
            this._logger.error(`Client protocol error (UDP): ${error.message}`);
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
        if (isNaN(port))
            return val;
        if (port >= 0)
            return port;
        return false;
    }
}

module.exports = Tracker;