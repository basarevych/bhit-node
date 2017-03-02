/**
 * Help command
 * @module commands/help
 */
const debug = require('debug')('bhit:command');

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
     * @param {object} argv             Minimist object
     * @return {Promise}
     */
    run(argv) {
        if (argv['_'].length < 2)
            return this.usage();

        let method = this[`help${this._util.dashedToCamel(argv['_'][1], true)}`];
        if (typeof method != 'function')
            return this.usage();

        return method.call(this, argv);
    }

    /**
     * General help
     */
    usage() {
        console.log('Usage:\tbhitctl <command> [<parameters]');
        console.log('Commands:');
        console.log('\thelp\t\tPrint help about any other command');
        console.log('\tinstall\t\tRegister the program in the system');
        console.log('\tcreate-db\tCreate the schema');
        console.log('\tclear-cache\tClear the cache');
        console.log('\tstart\t\tStart the tracker');
        console.log('\tstop\t\tStop the tracker');
        console.log('\trestart\t\tRestart the tracker');
        console.log('\tstatus\t\tQuery running status of the tracker');
        process.exit(0);
    }

    /**
     * Help command
     */
    helpHelp(argv) {
        console.log('Usage:\tbhitctl help <command>\n');
        console.log('\tPrint help for the given command');
        process.exit(0);
    }

    /**
     * Install command
     */
    helpInstall(argv) {
        console.log('Usage:\tbhitctl install <address>\n');
        console.log('\tThis command will register the program in the system and will create');
        console.log('\tconfiguration in /etc/bhit by default');
        console.log('\t<address> is either hostname or IP address the tracker will listen on');
        process.exit(0);
    }

    /**
     * Create DB command
     */
    helpCreateDb(argv) {
        console.log('Usage:\tbhitctl create-db\n');
        console.log('\tDrop if present and recreate all the database tables');
        process.exit(0);
    }

    /**
     * Clear Cache command
     */
    helpClearCache(argv) {
        console.log('Usage:\tbhitctl clear-cache\n');
        console.log('\tDrop Redis cache');
        process.exit(0);
    }

    /**
     * Start command
     */
    helpStart(argv) {
        console.log('Usage:\tbhitctl start\n');
        console.log('\tThis command will start the tracker');
        process.exit(0);
    }

    /**
     * Stop command
     */
    helpStop(argv) {
        console.log('Usage:\tbhitctl stop\n');
        console.log('\tThis command will stop the tracker');
        process.exit(0);
    }

    /**
     * Restart command
     */
    helpRestart(argv) {
        console.log('Usage:\tbhitctl restart\n');
        console.log('\tThis command will stop and start the tracker');
        process.exit(0);
    }

    /**
     * Status command
     */
    helpStatus(argv) {
        console.log('Usage:\tbhitctl status\n');
        console.log('\tThis command will print tracker status');
        process.exit(0);
    }

    /**
     * Log error and terminate
     * @param {...*} args
     */
    error(...args) {
        console.error(...args);
        process.exit(1);
    }
}

module.exports = Help;