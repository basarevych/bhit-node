/**
 * Start command
 * @module commands/start
 */
const path = require('path');
const execFile = require('child_process').execFile;
const argvParser = require('argv');

/**
 * Command class
 */
class Start {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} config           Configuration
     */
    constructor(app, config) {
        this._app = app;
        this._config = config;
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
        return [ 'app', 'config' ];
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

        return this.launch()
            .then(rc => {
                process.exit(rc);
            })
            .catch(error => {
                return this.error(error);
            })
    }

    /**
     * Launch the daemon
     */
    launch() {
        return this.exec('daemon')
            .then(result => {
                return Promise.resolve()
                    .then(() => {
                        if (result.code !== 0)
                            return this._app.info(result.stdout);
                    })
                    .then(() => {
                        if (result.code !== 0)
                            return this._app.error(result.stderr);
                    })
                    .then(() => {
                        return result.code;
                    });
            });
    }
    /**
     * Execute command echoing output
     * @param {string} command          Path to command
     * @param {string[]} [params]       Parameters
     * @return {Promise}
     */
    exec(command, params = []) {
        return new Promise((resolve, reject) => {
            try {
                let proc = execFile(
                    path.join(__dirname, '..', 'bin', command),
                    params,
                    (error, stdout, stderr) => {
                        resolve({
                            code: error ? error.code : 0,
                            stdout: stdout,
                            stderr: stderr,
                        });
                    }
                );
                proc.stdout.pipe(process.stdout);
                proc.stderr.pipe(process.stderr);
                process.stdin.pipe(proc.stdin);
            } catch (error) {
                reject(error);
            }
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

module.exports = Start;