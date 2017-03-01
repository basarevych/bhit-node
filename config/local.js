/**
 * Installation specific application configuration
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const ini = require('ini');

let userConfig;
try {
    userConfig = ini.parse(fs.readFileSync(os.platform() == 'freebsd' ? '/usr/local/etc/bhit/bhit.conf' : '/etc/bhit/bhit.conf', 'utf8'));
} catch (error) {
    userConfig = {};
}

module.exports = {
    // Server instance name (alphanumeric)
    instance: userConfig.instance || 'server1',

    // Environment
    env: process.env.NODE_ENV || 'production',

    // Loaded modules
    modules: [
        'tracker',
    ],

    // Servers
    servers: {
        tracker: {
            class: 'servers.tracker',
            host: userConfig.listen_address || "0.0.0.0",
            port: userConfig.listen_port || 42042,
            ssl: {
                key: userConfig.key_file,
                cert: userConfig.cert_file,
                ca: userConfig.ca_file,
/*
                // Let's Encrypt:
                key: '/etc/letsencrypt/live/server1.example.com/privkey.pem',
                cert: '/etc/letsencrypt/live/server1.example.com/fullchain.pem',
*/
            },
        },
    },

    // PUBSUB
    subscribers: [ // service names
        'subscribers.invalidateCache',
    ],

    // SMTP servers
    smtp: {
        main: {
            host: 'localhost',
            port: 25,
            ssl: false,
            //user: 'username',
            //password: 'password',
        },
    },

    // PostgreSQL servers
    postgres: {
        main: {
            host: 'localhost',
            port: 5432,
            user: 'username',
            password: 'password',
            db_name: 'dbname',
            min_pool: 10,
            max_pool: 100,
        },
    },

    // Redis servers
    redis: {
        main: {
            host: 'localhost',
            port: 6379,
            //password: 'password',
        },
    },

    session: {
        expire_timeout: 14 * 24 * 60 * 60,  // seconds, delete inactive sessions
        save_interval: 60,                  // seconds, 0 to update session in the DB on every request
        secret: 'some unique secret here',  // could be "pwgen 32 1" output
    },

    email: {
        from: 'root@localhost',
        logger: {
            info_enabled: false,            // email logger.info() or not
            warn_enabled: false,            // email logger.warn() or not
            error_enabled: false,           // email logger.error() or not
            to: 'debug@example.com',
        },
        daemon: {
            enabled: false,                 // email program crash or not
            to: 'debug@example.com',
        },
    },

    cache: {
        enable: true,
        redis: 'main',                      // Name of Redis configuration to use
        expire_min: 3 * 60,                 // seconds, minimum time to cache values for (random)
        expire_max: 5 * 60,                 // seconds, maximum time to cache values for (random)
    },

    logs: {
        main: {
            default: true,
            name: 'bhit.log',
            path: '/var/log/bhit',
            interval: '1d',
            mode: 0o640,
        },
    },
/*
    user: { // Drop privileges, otherwise comment out this section
        uid: 'www',
        gid: 'www',
    },
*/
};