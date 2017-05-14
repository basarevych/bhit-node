/**
 * Repo-saved application configuration
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const ini = require('ini');

let userConfig;
try {
    userConfig = ini.parse(fs.readFileSync(os.platform() === 'freebsd' ? '/usr/local/etc/bhit/bhit.conf' : '/etc/bhit/bhit.conf', 'utf8'));
} catch (error) {
    userConfig = {};
}

module.exports = {
    // Project name (alphanumeric)
    project: 'arpen',

    // Server instance name (alphanumeric)
    instance: (userConfig.tracker && userConfig.tracker.instance) || 'tracker',

    // Environment
    env: process.env.NODE_ENV || (process.env.DEBUG ? 'development' : 'production'),

    // Load base classes and services, path names
    autoload: [
        '!src/services',
        'commands',
        'servers',
        'services',
        'subscribers',
        'models',
        'repositories',
    ],

    // Loaded modules
    modules: [
        'tracker',
    ],

    // Servers
    servers: {
        tracker: {
            class: 'servers.tracker',
            host: (userConfig.tracker && userConfig.tracker.listen_address) || "0.0.0.0",
            port: (userConfig.tracker && userConfig.tracker.listen_port) || 42042,
            ssl: {
                key: userConfig.tracker && userConfig.tracker.key_file,
                cert: userConfig.tracker && userConfig.tracker.cert_file,
                ca: userConfig.tracker && userConfig.tracker.ca_file,
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
            host: userConfig.smtp && userConfig.smtp.host,
            port: userConfig.smtp && userConfig.smtp.port,
            ssl: userConfig.smtp && userConfig.smtp.ssl === 'yes',
            user: userConfig.smtp && userConfig.smtp.user,
            password: userConfig.smtp && userConfig.smtp.password,
        },
    },

    // PostgreSQL servers
    postgres: {
        main: {
            host: userConfig.postgres && userConfig.postgres.host,
            port: userConfig.postgres && userConfig.postgres.port,
            user: userConfig.postgres && userConfig.postgres.user,
            password: userConfig.postgres && userConfig.postgres.password,
            db_name: userConfig.postgres && userConfig.postgres.db_name,
            min_pool: 10,
            max_pool: 100,
        },
    },

    // Redis servers
    redis: {
        main: {
            host: userConfig.redis && userConfig.redis.host,
            port: userConfig.redis && userConfig.redis.port,
            password: userConfig.redis && userConfig.redis.password,
        },
    },

    email: {
        from: 'root@localhost',
        log: {
            enable: false,                 // email logger messages or not
            level: 'error',
            to: 'debug@example.com',
        },
        crash: {
            enable: false,                 // email program crash or not
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
            level: (userConfig.tracker && userConfig.tracker.log_level) || 'info',
            default: true,
            name: 'bhit.log',
            path: '/var/log/bhit',
            interval: '1d',
            mode: 0o640,
            maxFiles: 3,
        },
    },

/*
     user: { // Drop privileges, otherwise comment out this section
     uid: 'www',
     gid: 'www',
     },
*/
};
