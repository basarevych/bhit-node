/**
 * Help command
 * @module commands/help
 */
const argvParser = require('argv');

/**
 * Command class
 */
class Help {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} config           Configuration
     * @param {Util} util               Utility service
     */
    constructor(app, config, util) {
        this._app = app;
        this._config = config;
        this._util = util;
    }

    /**
     * Service name is 'commands.help'
     * @type {string}
     */
    static get provides() {
        return 'commands.help';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'util' ];
    }

    /**
     * Run the command
     * @param {string[]} argv           Arguments
     * @return {Promise}
     */
    run(argv) {
        let args = argvParser
            .option({
                name: 'help',
                short: 'h',
                type: 'boolean',
            })
            .run(argv);

        if (args.targets.length < 2)
            return this.usage();

        let method = this[`help${this._util.dashedToCamel(args.targets[1], true)}`];
        if (typeof method !== 'function')
            return this.usage();

        return method.call(this, argv);
    }

    /**
     * General help
     */
    usage() {
        return this._app.info(
                'Usage:\tbhitctl <command> [<parameters]\n\n' +
                'Commands:\n' +
                '\thelp\t\tPrint help about any other command\n' +
                '\tinstall\t\tRegister the program in the system\n' +
                '\tcreate-db\tCreate the database and the user\n' +
                '\tmigrate\t\tMigrate the database schema to current version\n' +
                '\tclear-cache\tClear the cache\n' +
                '\tstart\t\tStart the tracker\n' +
                '\tstop\t\tStop the tracker\n' +
                '\trestart\t\tRestart the tracker\n' +
                '\tstatus\t\tQuery running status of the tracker'
            )
            .then(() => {
                process.exit(0);
            });
    }

    /**
     * Help command
     */
    helpHelp(argv) {
        return this._app.info(
                'Usage:\tbhitctl help <command>\n\n' +
                '\tPrint help for the given command'
            )
            .then(() => {
                process.exit(0);
            });
    }

    /**
     * Install command
     */
    helpInstall(argv) {
        return this._app.info(
                'Usage:\tbhitctl install <address>\n\n' +
                '\tThis command will register the program in the system and will create\n' +
                '\tconfiguration in /etc/bhit by default\n' +
                '\t<address> is either hostname or IP address the tracker will listen on'
            )
            .then(() => {
                process.exit(0);
            });
    }

    /**
     * Create DB command
     */
    helpCreateDb(argv) {
        return this._app.info(
            'Usage:\tbhitctl create-db\n\n' +
            '\tDrop if present and recreate all the database tables'
            )
            .then(() => {
                process.exit(0);
            });
    }

    /**
     * Migrate DB command
     */
    helpMigrate(argv) {
        return this._app.info(
            'Usage:\tbhitctl migrate\n\n' +
            '\tUpdate the schema to make it match the current version'
            )
            .then(() => {
                process.exit(0);
            });
    }

    /**
     * Clear Cache command
     */
    helpClearCache(argv) {
        return this._app.info(
                'Usage:\tbhitctl clear-cache\n\n' +
                '\tDrop Redis cache'
            )
            .then(() => {
                process.exit(0);
            });
    }

    /**
     * Start command
     */
    helpStart(argv) {
        return this._app.info(
                'Usage:\tbhitctl start\n\n' +
                '\tThis command will start the tracker'
            )
            .then(() => {
                process.exit(0);
            });
    }

    /**
     * Stop command
     */
    helpStop(argv) {
        return this._app.info(
                'Usage:\tbhitctl stop\n\n' +
                '\tThis command will stop the tracker'
            )
            .then(() => {
                process.exit(0);
            });
    }

    /**
     * Restart command
     */
    helpRestart(argv) {
        return this._app.info(
                'Usage:\tbhitctl restart\n\n' +
                '\tThis command will stop and start the tracker'
            )
            .then(() => {
                process.exit(0);
            });
    }

    /**
     * Status command
     */
    helpStatus(argv) {
        return this._app.info(
                'Usage:\tbhitctl status\n\n' +
                '\tThis command will print tracker status'
            )
            .then(() => {
                process.exit(0);
            });
    }

    /**
     * Log error and terminate
     * @param {...*} args
     */
    error(...args) {
        return args.reduce(
            (prev, cur) => {
                return prev.then(() => {
                    return this._app.error(cur.fullStack || cur.stack || cur.message || cur);
                });
            },
            Promise.resolve()
            )
            .then(
                () => {
                    process.exit(1);
                },
                () => {
                    process.exit(1);
                }
            );
    }
}

module.exports = Help;