/**
 * Install command
 * @module commands/install
 */
const debug = require('debug')('bhit:command');
const path = require('path');
const fs = require('fs');

/**
 * Command class
 */
class Install {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} config           Configuration
     * @param {Runner} runner           Runner service
     */
    constructor(app, config, runner) {
        this._app = app;
        this._config = config;
        this._runner = runner;
    }

    /**
     * Service name is 'commands.install'
     * @type {string}
     */
    static get provides() {
        return 'commands.install';
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
     * @param {object} argv             Minimist object
     * @return {Promise}
     */
    run(argv) {
        if (argv['_'].length < 2)
            return this.error('Invalid parameters');

        let hostname = argv['_'][1];

        return this._runner.exec('uname', [ '-s' ])
            .then(result => {
                if (result.code !== 0)
                    throw new Error('Could not get platform name');

                let configDir;
                if (result.stdout.trim() == 'FreeBSD') {
                    configDir = '/usr/local/etc/bhit';
                    debug(`Platform: FreeBSD`);
                } else {
                    configDir = '/etc/bhit';
                    debug(`Platform: Linux`);
                }

                try {
                    fs.accessSync(configDir, fs.constants.F_OK);
                    return this.error('Configuration directory already exists');
                } catch (error) {
                    // do nothing
                }

                debug('Creating config dir');
                fs.mkdirSync(configDir, 0o750);
                fs.mkdirSync(path.join(configDir, 'certs'), 0o755);
                try {
                    fs.mkdirSync('/var/run/bhit', 0o750);
                } catch (error) {
                    // do nothing
                }
                try {
                    fs.mkdirSync('/var/log/bhit', 0o750);
                } catch (error) {
                    // do nothing
                }

                debug('Creating default config');
                let config = fs.readFileSync(path.join(__dirname, '..', 'config', 'local.js.example'), { encoding: 'utf8'});
                config = config.replace(/CONFIG_DIR/g, configDir);
                config = config.replace(/NAME/g, hostname);
                fs.writeFileSync(path.join(configDir, 'config.js'), config, { mode: 0o640 });

                try {
                    fs.symlinkSync(path.join(configDir, 'config.js'), path.join(__dirname, '..', 'config', 'local.js'));
                } catch (error) {
                    // do nothing
                }

                try {
                    fs.accessSync('/etc/systemd/system', fs.constants.F_OK);
                    debug('Creating service');
                    let service = fs.readFileSync(path.join(__dirname, '..', 'bhit.service'), {encoding: 'utf8'});
                    fs.writeFileSync('/etc/systemd/system/bhit.service', service, {mode: 0o644});
                } catch (error) {
                    console.log('Could not create systemd service - skipping...');
                }

                debug('Creating temporary openssl config');
                let type = (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) ? 'IP' : 'DNS');
                let sslConfig = fs.readFileSync('/etc/ssl/openssl.cnf', { encoding: 'utf8' });
                sslConfig += `\n[SAN]\nsubjectAltName=${type}:${hostname}\n`;
                fs.writeFileSync('/tmp/bhit.openssl.cnf', sslConfig, { mode: 0o644 });

                debug('Creating self-signed certificate');
                this._runner.exec(
                        'openssl',
                        [
                            'req',
                            '-new',
                            '-newkey', 'rsa:2048',
                            '-days', '3650',
                            '-nodes',
                            '-x509',
                            '-subj', '/C=/ST=/L=/O=/CN=' + hostname,
                            '-reqexts', 'SAN',
                            '-extensions', 'SAN',
                            '-config', '/tmp/bhit.openssl.cnf',
                            '-keyout', path.join(configDir, 'certs', hostname + '.key'),
                            '-out', path.join(configDir, 'certs', hostname + '.cert')
                        ]
                    )
                    .then(result => {
                        try {
                            fs.unlinkSync('/tmp/bhit.openssl.cnf');
                        } catch (error) {
                            // do nothing
                        }
                        if (result.code !== 0)
                            throw new Error('Could not create self-signed certificate');
                    });
            })
            .catch(error => {
                this.error(error.message);
            });
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

module.exports = Install;