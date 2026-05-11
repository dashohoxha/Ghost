const {combineTransactionalMigrations, addPermissionWithRoles} = require('../../utils');

module.exports = combineTransactionalMigrations(
    addPermissionWithRoles({
        name: 'Rotate all API keys',
        action: 'rotateApiKeys',
        object: 'security_action'
    }, [
        'Administrator'
    ])
);
