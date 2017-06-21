/**
 * Known daemons registry service
 * @module services/registry
 */
const uuid = require('uuid');

class Registry {
    /**
     * Create the service
     * @param {Logger} logger               Logger service
     */
    constructor(logger) {
        // open sockets
        this.clients = new Map();           // socketId -> { id, identity: key hash, key: public key, daemonId,
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

    addClient(id) {
        let client = {
            id: id,
            identity: null,
            key: null,
            daemonId: null,
            connections: new Map(),
        };
        this.clients.set(id, client);
    }

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

    registerDaemon(clientId, daemonId, daemonName, identity, key, userId, userEmail) {
        let client = this.clients.get(clientId);
        if (!client)
            return false;

        client.daemonId = daemonId;
        client.identity = identity;
        client.key = key;

        let info = this.identities.get(identity);
        if (!info) {
            info = {
                clients: new Set(),
            };
            this.identities.set(identity, info);
        }
        info.clients.add(clientId);

        let daemon = this.daemons.get(daemonId);
        if (!daemon) {
            daemon = {
                id: daemonId,
                name: daemonName,
                userId: userId,
                userEmail: userEmail,
                clients: new Set(),
            };
            this.daemons.set(daemonId, daemon);
        }
        daemon.clients.add(clientId);

        return true;
    }

    updateConnection(connectionName, clientId, actingAs, active, connected, internalAddresses = []) {
        let client = this.clients.get(clientId);
        if (!client || !client.daemonId)
            return;

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
            this._logger.info(`${connected} peers are connected to ${daemon.name} (${actingAs}) in ${connectionName}`);
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
