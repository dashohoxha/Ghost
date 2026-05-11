const {combineTransactionalMigrations, addPermissionWithRoles} = require('../../utils');

// "Reset staff passwords" is intentionally not defined as a permission —
// it's an owner-only action, gated in the endpoint via the existing
// `assign.role(Owner)` permission check (same pattern as transferOwnership).
// Following the Ghost convention of not registering permission rows for
// owner-only actions.
module.exports = combineTransactionalMigrations(
    addPermissionWithRoles({
        name: 'Rotate all API keys',
        action: 'rotateApiKeys',
        object: 'security_action'
    }, [
        'Administrator'
    ])
);
