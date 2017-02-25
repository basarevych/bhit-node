#!/usr/bin/env node

"use strict";

const argv = require('minimist')(process.argv.slice(2));
const path = require('path');
const fs = require('fs');
const execFile = require('child_process').execFile;
const Runner = require(path.join(__dirname, 'node_modules', 'arpen', 'src', 'services', 'runner.js'));

let pidPath = path.join('/var', 'run', 'bhit', 'bhit.pid');

function usage() {
    console.log('Usage: bhit <command>');
    console.log('Commands:');
    console.log('\thelp\t\tPrint help about any other command');
    console.log('\tinstall\t\tRegister the program in the system');
    console.log('\tcreate-db\tCreate the schema');
    console.log('\tclear-cache\tClear the cache');
    console.log('\tstart\t\tStart the daemon');
    console.log('\tstop\t\tStop the daemon');
}

function execDaemon() {
    let runner = new Runner();
    let proc = runner.spawn(path.join(__dirname, 'bin', 'daemon'), [ pidPath, 'tracker' ]);
    proc.cmd.on('data', data => { process.stdout.write(data); });
    return proc.promise;
}

function execCommand(command, params) {
    return new Promise((resolve, reject) => {
        try {
            let proc = execFile(
                path.join(__dirname, 'bin', command),
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

if (!argv['_'].length) {
    usage();
    process.exit(0);
}
if (argv['_'][0] != 'help' && argv['_'][0] != 'install') {
    let etcExists = false;
    for (let dir of [ '/etc/bhit', '/usr/local/etc/bhit' ]) {
        try {
            fs.accessSync(dir, fs.constants.F_OK);
            etcExists = true;
            break;
        } catch (error) {
            // do nothing
        }
    }
    let workExists = true;
    for (let dir of [ '/var/run/bhit', '/var/log/bhit' ]) {
        try {
            fs.accessSync(dir, fs.constants.F_OK);
        } catch (error) {
            workExists = false;
            break;
        }
    }
    if (!etcExists || !workExists) {
        console.log('Run "bhit install" first');
        process.exit(1);
    }
}

switch (argv['_'][0]) {
    case 'help':
        switch (argv['_'][1]) {
            case 'install':
                console.log('Usage: bhit install <hostname|ip-address>\n');
                console.log('\tThis command will register the program in the system');
                console.log('\tand will create configuration in /etc/bhit by default');
                break;
            case 'create-db':
                console.log('Usage: bhit create-db\n');
                console.log('\tThis command will (re)create the database schema in Postgres');
                break;
            case 'clear-cache':
                console.log('Usage: bhit clear-cache\n');
                console.log('\tThis command will drop all the data in Redis');
                break;
            case 'start':
                console.log('Usage: bhit start\n');
                console.log('\tThis command will start the server');
                console.log('\tYou might want to run "systemctl bhit start" instead');
                break;
            case 'stop':
                console.log('Usage: bhit stop\n');
                console.log('\tThis command will stop the server');
                console.log('\tYou might want to run "systemctl bhit stop" instead');
                break;
            default:
                console.log('Usage: bhit help <command>');
                process.exit(1);
        }
        break;
    case 'install':
    case 'create-db':
    case 'clear-cache':
        execCommand('cmd', process.argv.slice(2))
            .then(result => {
                process.exit(result.code);
            })
            .catch(error => {
                console.log(error.message);
                process.exit(1);
            });
        break;
    case 'start':
        execDaemon()
            .then(result => {
                process.exit(result.code);
            })
            .catch(error => {
                console.log(error.message);
                process.exit(1);
            });
        break;
    case 'stop':
        execCommand('kill', [ pidPath ])
            .then(result => {
                process.exit(result.code);
            })
            .catch(error => {
                console.log(error.message);
                process.exit(1);
            });
        break;
    default:
        usage();
        process.exit(1);
}
