/**
 * Start command
 * @module commands/start
 */
const path = require('path');
const argvParser = require('argv');
const Base = require('./base');

/**
 * Command class
 */
class Start extends Base {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} config           Configuration
     * @param {Runner} runner           Runner service
     */
    constructor(app, config, runner) {
        super(app);
        this._config = config;
        this._runner = runner;
    }

    /**
     * Service name is 'commands.start'
     * @type {string}
     */
    static get provides() {
        return 'commands.start';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'runner' ];
    }

    /**
     * Run the command
     * @param {string[]} argv           Arguments
     * @return {Promise}
     */
    async run(argv) {
        argvParser
            .option({
                name: 'help',
                short: 'h',
                type: 'boolean',
            })
            .run(argv);

        try {
            return await this.launch();
        } catch (error) {
            await this.error(error);
        }
    }

    /**
     * Launch the daemon
     * @return {Promise}
     */
    async launch() {
        let result = await this._runner.exec(
            path.join(__dirname, '..', '..', 'bin', 'daemon'),
            [],
            { pipe: process }
        );
        return result.code;
    }
}

module.exports = Start;
