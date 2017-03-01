/**
 * Repo-saved application configuration
 */
module.exports = {
    // Project name (alphanumeric)
    project: 'arpen',

    // Load base classes and services, path names
    autoload: [
        '!src/servers',
        '!src/services',
        'commands',
        'servers',
        'subscribers',
        'models',
        'repositories',
    ],
};
