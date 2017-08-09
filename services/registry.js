/**
 * Known daemons registry service
 * @module services/registry
 */
const uuid = require('uuid');

/**
 * Server state registry
 */
class Registry {
    /**
     * Create the service
     * @param {App} app                     The application
     * @param {object} config               Configuration
     * @param {Logger} logger               Logger service
     */
    constructor(app, config, logger) {
        // open sockets
        this.clients = new Map();           // socketId -> RegistryClient(socketId)
                                            // id is the same as with TrackerClient

        // connected daemons
        this.daemons = new Map();           // daemonId -> RegistryDaemon(daemonId)

        // identities lookup map
        this.identities = new Map();        // identity -> RegistryIdentity(identity)

        // daemons waiting for server
        this.waiting = new Map();           // connectionName -> RegistryWaiting(connectionName)

        // daemons waiting for hole punching info
        this.pairs = new Map();             // serverRequestId and clientRequestId -> the same RegistryPair(serverRequestId, clientRequestId)

        this._app = app;
        this._config = config;
        this._logger = logger;
        this._timer = setInterval(this._checkTimeout.bind(this), 1000);
    }

    /**
     * Service name is 'registry'
     * @type {string}
     */
    static get provides() {
        return 'registry';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'logger' ];
    }

    /**
     * This service is a singleton
     * @type {string}
     */
    static get lifecycle() {
        return 'singleton';
    }

    /**
     * Address request respond timeout
     * @type {number}
     */
    static get pairTimeout() {
        return 5 * 1000; // ms
    }

    /**
     * Validate name
     * @param {string} name                 Name to check
     * @return {boolean}
     */
    validateName(name) {
        if (!name.length)
            return false;

        return /^[-._0-9a-zA-Z]+$/.test(name);
    }

    /**
     * Validate email checking allow_users in the config
     * @param {string} email                Email to check
     * @return {boolean}
     */
    validateEmail(email) {
        if (email.indexOf('@') === -1)
            return false;

        let parts = email.split('@');
        if (parts.length !== 2)
            return false;

        if (!parts[0].length && !parts[1].length)
            return false;

        let whiteList = this._config.get('servers.tracker.allow_users');
        if (!whiteList || !whiteList.length)
            return true;

        for (let entry of whiteList) {
            if (entry.indexOf('@') === -1) {
                if (parts[1] === entry)
                    return true;
            } else {
                if (email === entry)
                    return true;
            }
        }
        return false;
    }

    /**
     * Validate path
     * @param {string} path                 Path to check
     * @param {boolean} [named=false]       Require email at the beginning
     * @return {object|boolean}
     */
    validatePath(path, named = false) {
        if (!path.length)
            return false;

        let parts = path.split('/');
        if (parts.length < 2)
            return false;

        let email = parts.shift();
        if (named && !email)
            return false;
        if (email && !this.validateEmail(email))
            return false;

        for (let node of parts) {
            if (!this.validateName(node))
                return false;
        }

        return { email, path: '/' + parts.join('/') };
    }

    /**
     * Validate connections name
     * @param {string} name                 Name
     * @return {object|boolean}
     */
    validateConnectionName(name) {
        let parts = name.split('/');
        if (parts.length < 2)
            return false;

        let emailPart = parts.shift();
        let pathPart = '/' + parts.join('/');

        if (!this.validateEmail(emailPart) || !this.validatePath(pathPart))
            return false;

        return { email: emailPart, path: pathPart };
    }

    /**
     * Calculate overridden host:port pair
     * @param {string} defaultHost
     * @param {string} defaultPort
     * @param {string} overrideHost
     * @param {string} overridePort
     * @return {object}
     */
    addressOverride(defaultHost, defaultPort, overrideHost, overridePort) {
        let host = (defaultHost || ''), port = (defaultPort || '');
        if (port && port[0] === '/')
            host = '';

        if (overridePort && overridePort[0] === '/') {
            host = '';
            port = overridePort;
        } else {
            if (overrideHost)
                host = overrideHost;
            if (overridePort)
                port = overridePort
        }
        
        return { address: host, port: port };
    }

    /**
     * Register new client
     * @param {string} id
     */
    addClient(id) {
        let client = this._app.get('entities.registryClient', id);
        this.clients.set(id, client);
    }

    /**
     * Forget a client
     * @param {string} id
     */
    removeClient(id) {
        let client = this.clients.get(id);
        if (!client)
            return;

        if (client.daemonId) {
            let info = this.daemons.get(client.daemonId);
            if (info) {
                info.clients.delete(id);
                if (!info.clients.size) // no clients left
                    this.daemons.delete(client.daemonId);
            }
        }

        if (client.identity) {
            let info = this.identities.get(client.identity);
            if (info)
                info.clients.delete(id);
        }

        for (let name of client.connections.keys()) {
            let waiting = this.waiting.get(name);
            if (waiting) {
                if (waiting.server === id) {
                    waiting.server = null;
                    waiting.internalAddresses = [];
                    this._logger.info(`No server for ${name} anymore`);
                }
                for (let thisClientId of waiting.clients) {
                    if (thisClientId === id) {
                        waiting.clients.delete(thisClientId);
                        this._logger.info(`Client left ${name}`);
                    }
                }
                if (!waiting.server && !waiting.clients.size)
                    this.waiting.delete(name);
            }
        }

        this.clients.delete(id);
    }

    /**
     * Identify client as a daemon
     * @param {object} info
     * @param {string} info.clientId
     * @param {number} info.daemonId
     * @param {string} info.daemonName
     * @param {string} info.identity
     * @param {string} info.key
     * @param {string} info.hostname
     * @param {string} info.version
     * @param {number} info.userId
     * @param {string} info.userEmail
     * @return {boolean}
     */
    registerDaemon(info) {
        let client = this.clients.get(info.clientId);
        if (!client)
            return false;

        client.daemonId = info.daemonId;
        client.identity = info.identity;
        client.key = info.key;
        client.hostname = info.hostname || '?';
        client.version = info.version || '?';

        let identityInfo = this.identities.get(info.identity);
        if (!identityInfo) {
            identityInfo = this._app.get('entities.registryIdentity', info.identity);
            this.identities.set(info.identity, identityInfo);
        }
        identityInfo.clients.add(info.clientId);

        let daemon = this.daemons.get(info.daemonId);
        if (!daemon) {
            daemon = this._app.get('entities.registryDaemon', info.daemonId);
            daemon.name = info.daemonName;
            daemon.userId = info.userId;
            daemon.userEmail = info.userEmail;
            this.daemons.set(info.daemonId, daemon);
        }
        daemon.clients.add(info.clientId);

        return true;
    }

    /**
     * Remove daemon with clients from all data structures
     * @param {number} daemonId
     */
    removeDaemon(daemonId) {
        let daemon = this.daemons.get(daemonId);
        if (daemon) {
            for (let clientId of daemon.clients)
                this.removeClient(clientId);
            this.daemons.delete(daemonId);
        }
    }

    /**
     * Update status of a connection of a daemon
     * @param {string} connectionName
     * @param {string} clientId
     * @param {string} actingAs
     * @param {boolean} active
     * @param {number} connected
     * @param {object} internalAddresses
     */
    updateConnection(connectionName, clientId, actingAs, active, connected, internalAddresses = []) {
        let client = this.clients.get(clientId);
        if (!client || !client.daemonId)
            return;

        for (let item of internalAddresses)
            client.ips.add(item.address);

        let daemon = this.daemons.get(client.daemonId);
        if (!daemon)
            return;

        if (active) {
            let connection = client.connections.get(connectionName);
            if (!connection) {
                connection = this._app.get('entities.registryClientConnection', connectionName);
                connection.server = (actingAs === 'server');
                connection.connected = 0;
                client.connections.set(connectionName, connection);
            }
            connection.connected = connected;
            this._logger.info(`${daemon.name} (${actingAs}) has ${connected} peer(s) connected in ${connectionName}`);
        } else {
            client.connections.delete(connectionName);
            this._logger.info(`Daemon ${daemon.name} (${actingAs}) removed from ${connectionName}`);
        }

        let waiting = this.waiting.get(connectionName);
        if (!waiting) {
            waiting = this._app.get('entities.registryWaiting', connectionName);
            waiting.server = null;
            waiting.internalAddresses = [];
            this.waiting.set(connectionName, waiting);
        }

        if (actingAs === 'server') {
            waiting.server = active ? clientId : null;
            waiting.internalAddresses = active ? internalAddresses : [];
        } else {
            if (active) {
                if (connected)
                    waiting.clients.delete(clientId);
                else
                    waiting.clients.add(clientId);
            } else {
                waiting.clients.delete(clientId);
            }
        }
    }

    /**
     * Get ready server of a connection and all the clients that's been waiting for it
     * @param {string} connectionName
     * @return {object}
     */
    checkWaiting(connectionName) {
        let waiting = this.waiting.get(connectionName);
        if (!waiting)
            return null;

        if (!waiting.internalAddresses.length || !waiting.clients.size)
            return null;

        let serverInfo = this.clients.get(waiting.server);
        if (!serverInfo || !serverInfo.daemonId)
            return null;

        let serverDaemon = this.daemons.get(serverInfo.daemonId);
        if (!serverDaemon)
            return null;

        let result = this._app.get('entities.registryWaitingResult', waiting, serverDaemon);
        waiting.clients.clear();

        return result;
    }

    /**
     * Remove all or specific clients from a connection
     * @param {string} connectionName
     * @param {string[]} clients
     * @return {Array}
     */
    removeConnection(connectionName, clients = []) {
        let updatedClients = [];
        for (let id of clients.length ? clients : Array.from(this.clients.keys())) {
            let client = this.clients.get(id);
            if (client && client.connections.has(connectionName)) {
                if (updatedClients.indexOf(id) === -1)
                    updatedClients.push(id);
                client.connections.delete(connectionName);
            }
        }

        let waiting = this.waiting.get(connectionName);
        if (waiting) {
            if (waiting.server) {
                let server = this.clients.get(waiting.server);
                if (!server || !server.connections.has(connectionName)) {
                    waiting.server = null;
                    waiting.internalAddresses = [];
                }
            }
            for (let id of waiting.clients) {
                let client = this.clients.get(id);
                if (!client || !client.connections.has(connectionName))
                    waiting.clients.delete(id);
            }
            if (!waiting.server && !waiting.clients.size)
                this.waiting.delete(connectionName);
        }

        return updatedClients;
    }

    /**
     * Create pair of clients waiting for each other external address
     * @param {string} connectionName
     * @param {string} serverId
     * @param {string} clientId
     * @return {object}
     */
    createPair(connectionName, serverId, clientId) {
        let clientRequestId = uuid.v1(), serverRequestId = uuid.v1();
        let pair = this._app.get('entities.registryPair', serverRequestId, clientRequestId);
        pair.serverId = serverId;
        pair.serverAddress = null;
        pair.serverPort = null;
        pair.clientId = clientId;
        pair.clientAddress = null;
        pair.clientPort = null;
        pair.timestamp = Date.now() + this.constructor.pairTimeout;
        pair.connectionName = connectionName;

        this.pairs.set(serverRequestId, pair);
        this.pairs.set(clientRequestId, pair);

        return pair;
    }

    /**
     * Update a party of a pair possibly returning ready to use pair
     * @param {string} requestId
     * @param {string} address
     * @param {string} port
     * @return {object|null}
     */
    updatePair(requestId, address, port) {
        let pair = this.pairs.get(requestId);
        if (!pair)
            return null;

        if (pair.serverRequestId === requestId) {
            pair.serverAddress = address;
            pair.serverPort = port;
        } else if (pair.clientRequestId === requestId) {
            pair.clientAddress = address;
            pair.clientPort = port;
        }

        if (!pair.serverPort || !pair.clientPort)
            return null;

        this.pairs.delete(pair.serverRequestId);
        this.pairs.delete(pair.clientRequestId);

        return pair;
    }

    /**
     * Check pair timeout
     */
    _checkTimeout() {
        let now = Date.now();
        for (let [ id, info ] of this.pairs) {
            if (now >= info.timeout) {
                this.pairs.delete(info.clientRequestId);
                this.pairs.delete(info.serverRequestId);
            }
        }
    }
}

module.exports = Registry;
