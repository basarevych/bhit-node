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
     * @param {Logger} logger               Logger service
     */
    constructor(logger) {
        // open sockets
        this.clients = new Map();           // socketId -> { id, identity: key hash, key: public key, hostname, version,
                                            //               daemonId, ips: Set(of internal ips),
                                            //               connections: Map(name -> { server: bool, connected: counter }) }

        // connected daemons
        this.daemons = new Map();           // daemonId -> { id, name, userId, userEmail, clients: Set(clientId) }

        // identities lookup map
        this.identities = new Map();        // identity -> { clients: Set(clientId) }

        // daemons waiting for connection
        this.waiting = new Map();           // connectionName -> { server: clientId, internalAddresses: [message InternalAddress], clients: Set(clientId) }

        // daemons waiting for hole punching info
        this.pairs = new Map();             // clientRequestId/serverRequestId ->
                                            //      { timeout, connectionName, clientId, clientRequestId,
                                            //        clientAddress, clientPort, serverId, serverRequestId,
                                            //        serverAddress, serverPort }

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
        return [ 'logger' ];
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

    validateEmail(email) {
        if (email.indexOf('@') === -1)
            return false;

        let parts = email.split('@');
        if (parts.length !== 2)
            return false;

        return parts[0].length > 0 && parts[1].length > 0;
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
     * Register new client
     * @param {string} id
     */
    addClient(id) {
        let client = {
            id: id,
            identity: null,
            key: null,
            hostname: '',
            ips: new Set(),
            daemonId: null,
            connections: new Map(),
        };
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
        client.hostname = info.hostname;
        client.version = info.version;

        let identityInfo = this.identities.get(info.identity);
        if (!identityInfo) {
            identityInfo = {
                clients: new Set(),
            };
            this.identities.set(info.identity, identityInfo);
        }
        identityInfo.clients.add(info.clientId);

        let daemon = this.daemons.get(info.daemonId);
        if (!daemon) {
            daemon = {
                id: info.daemonId,
                name: info.daemonName,
                userId: info.userId,
                userEmail: info.userEmail,
                clients: new Set(),
            };
            this.daemons.set(info.daemonId, daemon);
        }
        daemon.clients.add(info.clientId);

        return true;
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
            let connections = client.connections.get(connectionName);
            if (!connections) {
                connections = {
                    server: actingAs === 'server',
                    connected: 0,
                };
                client.connections.set(connectionName, connections);
            }
            connections.connected = connected;
            this._logger.info(`${daemon.name} (${actingAs}) has ${connected} peer(s) connected in ${connectionName}`);
        } else {
            client.connections.delete(connectionName);
            this._logger.info(`Daemon ${daemon.name} (${actingAs}) removed from ${connectionName}`);
        }

        let waiting = this.waiting.get(connectionName);
        if (!waiting) {
            waiting = {
                server: null,
                internalAddresses: [],
                clients: new Set(),
            };
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

        let result = {
            info: {
                connectionName: connectionName,
                daemonName: serverDaemon.name,
                internalAddresses: waiting.internalAddresses,
            },
            targets: Array.from(waiting.clients)
        };
        waiting.clients.clear();

        if (!waiting.internalAddresses.length && !waiting.clients.size)
            this.waiting.delete(connectionName);

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
        let pair = {
            timestamp: Date.now() + this.constructor.pairTimeout,
            connectionName: connectionName,
            clientId: clientId,
            clientRequestId: clientRequestId,
            clientAddress: null,
            clientPort: null,
            serverId: serverId,
            serverRequestId: serverRequestId,
            serverAddress: null,
            serverPort: null,
        };

        this.pairs.set(clientRequestId, pair);
        this.pairs.set(serverRequestId, pair);

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
