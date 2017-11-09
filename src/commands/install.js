/**
 * Install command
 * @module commands/install
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const argvParser = require('argv');
const Base = require('./base');

/**
 * Command class
 */
class Install extends Base {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} config           Configuration
     * @param {Runner} runner           Runner service
     * @param {Util} util               Util service
     * @param {Help} help               Help command
     */
    constructor(app, config, runner, util, help) {
        super(app);
        this._config = config;
        this._runner = runner;
        this._util = util;
        this._help = help;
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
        return [ 'app', 'config', 'runner', 'util', 'commands.help' ];
    }

    /**
     * Run the command
     * @param {string[]} argv           Arguments
     * @return {Promise}
     */
    async run(argv) {
        let args = argvParser
            .option({
                name: 'help',
                short: 'h',
                type: 'boolean',
            })
            .run(argv);

        if (args.targets.length < 2)
            return this._help.helpInstall(argv);

        let hostname = args.targets[1];

        try {
            let configDir;
            if (os.platform() === 'freebsd') {
                configDir = '/usr/local/etc/bhit';
                await this._app.debug(`Platform: FreeBSD`);
            } else {
                configDir = '/etc/bhit';
                await this._app.debug(`Platform: Linux`);
            }

            try {
                fs.accessSync(configDir, fs.constants.F_OK);
            } catch (error) {
                try {
                    fs.mkdirSync(configDir, 0o755);
                } catch (error) {
                    throw new Error(`Could not create ${configDir}`);
                }
            }
            try {
                fs.accessSync(path.join(configDir, 'certs'), fs.constants.F_OK);
            } catch (error) {
                try {
                    fs.mkdirSync(path.join(configDir, 'certs'), 0o755);
                } catch (error) {
                    throw new Error(`Could not create ${path.join(configDir, 'certs')}`);
                }
            }
            try {
                fs.accessSync('/var/run/bhit', fs.constants.F_OK);
            } catch (error) {
                try {
                    fs.mkdirSync('/var/run/bhit', 0o755);
                } catch (error) {
                    throw new Error(`Could not create /var/run/bhit`);
                }
            }
            try {
                fs.accessSync('/var/log/bhit', fs.constants.F_OK);
            } catch (error) {
                try {
                    fs.mkdirSync('/var/log/bhit', 0o755);
                } catch (error) {
                    throw new Error(`Could not create /var/log/bhit`);
                }
            }

            try {
                await this._app.debug('Creating default config');
                fs.accessSync(path.join(configDir, 'bhit.conf'), fs.constants.F_OK);
            } catch (error) {
                try {
                    let config = fs.readFileSync(path.join(__dirname, '..', '..', 'bhit.conf'), {encoding: 'utf8'});
                    config = config.replace(/HOSTNAME/g, hostname).replace(/DB_PASSWORD/g, this._util.getRandomString(32));
                    fs.writeFileSync(path.join(configDir, 'bhit.conf'), config, {mode: 0o644});
                } catch (error) {
                    throw new Error(`Could not create bhit.conf`);
                }
            }
            try {
                fs.accessSync('/etc/systemd/system', fs.constants.F_OK);
                await this._app.debug('Creating systemd service');
                let service = fs.readFileSync(path.join(__dirname, '..', '..', 'systemd.service'), {encoding: 'utf8'});
                fs.writeFileSync('/etc/systemd/system/bhit.service', service, {mode: 0o644});
            } catch (error) {
                // do nothing
            }
            try {
                fs.accessSync('/etc/init.d', fs.constants.F_OK);
                await this._app.debug('Creating sysvinit service');
                let service = fs.readFileSync(path.join(__dirname, '..', '..', 'sysvinit.service'), {encoding: 'utf8'});
                fs.writeFileSync('/etc/init.d/bhit', service, {mode: 0o755});
            } catch (error) {
                // do nothing
            }

            let certExists = false;
            try {
                fs.accessSync(path.join(configDir, 'certs', hostname + '.key'), fs.constants.F_OK);
                fs.accessSync(path.join(configDir, 'certs', hostname + '.cert'), fs.constants.F_OK);
                certExists = true;
            } catch (error) {
                // do nothing
            }

            if (certExists)
                return;

            await this._app.debug('Creating temporary openssl config');
            let type = (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) ? 'IP' : 'DNS');
            let sslConfig = fs.readFileSync('/etc/ssl/openssl.cnf', {encoding: 'utf8'});
            sslConfig += `\n[SAN]\nsubjectAltName=${type}:${hostname}\n`;
            fs.writeFileSync('/tmp/bhit.openssl.cnf', sslConfig, {mode: 0o644});

            await this._app.debug('Creating self-signed certificate');
            let result = await this._runner.exec(
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
            );

            try {
                fs.unlinkSync('/tmp/bhit.openssl.cnf');
            } catch (error) {
                // do nothing
            }

            if (result.code !== 0)
                throw new Error('Could not create self-signed certificate');

            await this._app.debug('done');
            return 0;
        } catch (error) {
            await this.error(error);
        }
    }
}

module.exports = Install;
