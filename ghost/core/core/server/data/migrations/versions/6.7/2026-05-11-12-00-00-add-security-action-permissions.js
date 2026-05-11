const {combineTransactionalMigrations, addPermissionWithRoles} = require('../../utils');

module.exports = combineTransactionalMigrations(
    addPermissionWithRoles({
        name: 'Rotate all API keys',
        action: 'rotateApiKeys',
        object: 'security_action'
    }, [
        'Administrator'
    ]),
    addPermissionWithRoles({
        name: 'Reset staff passwords',
        action: 'resetStaffPasswords',
        object: 'security_action'
    }, [
        // Owner is granted implicitly via the can-this short-circuit;
        // we still register the permission row for visibility, but no
        // role is granted (the endpoint enforces Owner-only at request time).
    ])
);
