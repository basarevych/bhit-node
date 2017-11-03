/**
 * Repo-saved application configuration
 */
const os = require('os');
const fs = require('fs');
const Ini = require('arpen/src/services/ini');

let userConfig;
try {
    let ini = new Ini();
    userConfig = ini.parse(fs.readFileSync(os.platform() === 'freebsd' ? '/usr/local/etc/bhit/bhit.conf' : '/etc/bhit/bhit.conf', 'utf8'));
} catch (error) {
    userConfig = {};
}

module.exports = {
    // Project name (alphanumeric)
    project: 'interconnect',

    // Server instance name (alphanumeric)
    instance: (userConfig.tracker && userConfig.tracker.instance) || 'tracker',

    // Environment
    env: process.env.NODE_ENV || (process.env.DEBUG ? 'development' : 'production'),

    // Load base classes and services, path names
    autoload: [
        '~arpen/src',
        'src',
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
            allow_users: (userConfig.tracker && userConfig.tracker.allow_users) || [],
        },
    },

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
            database: userConfig.postgres && userConfig.postgres.db_name,
            min_pool: 10,
            max_pool: 100,
        },
    },

    // Redis servers
    redis: {
        cache: {
            host: userConfig.redis && userConfig.redis.host,
            port: userConfig.redis && userConfig.redis.port,
            password: userConfig.redis && userConfig.redis.password,
            database: 1,
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
        subscribe: [
            { postgres: 'main' },           // Invalidate cache pubsub provider
        ],
        redis: 'cache',                     // Name of Redis configuration to use
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
            max_files: 3,
            history: '/var/log/bhit/bhit.log.history',
        },
    },

/*
     user: { // Drop privileges, otherwise comment out this section
        uid: 'www',
        gid: 'www',
     },
*/
};
