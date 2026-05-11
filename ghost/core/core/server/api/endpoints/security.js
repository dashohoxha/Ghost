const errors = require('@tryghost/errors');
const tpl = require('@tryghost/tpl');
const models = require('../../models');
const auth = require('../../services/auth');
const permissionsService = require('../../services/permissions');
const {deleteAllSessions} = require('../../services/auth/session');
const SecurityActionsService = require('../../services/security-actions/security-actions-service');

const apiMail = require('./index').mail;
const apiSettings = require('./index').settings;

const messages = {
    ownerOnly: 'This action can only be performed by the site owner.'
};

const securityActions = new SecurityActionsService({
    models,
    auth,
    deleteAllSessions,
    apiMail,
    apiSettings
});

/** @type {import('@tryghost/api-framework').Controller} */
const controller = {
    docName: 'security_action',

    rotateApiKeys: {
        statusCode: 200,
        headers: {
            cacheInvalidate: false
        },
        permissions: true,
        async query(frame) {
            return securityActions.rotateApiKeys(frame.options);
        }
    },

    resetStaffPasswords: {
        statusCode: 200,
        headers: {
            cacheInvalidate: false
        },
        async permissions(frame) {
            // Owner-only: granting "all" permissions on this resource via
            // can-this is short-circuited for the Owner role; assigning the
            // Owner role itself requires owner privilege already, so we
            // re-use that permission check as a stand-in.
            const ownerRole = await models.Role.findOne({name: 'Owner'});
            try {
                await permissionsService.canThis(frame.options.context).assign.role(ownerRole);
            } catch (err) {
                throw new errors.NoPermissionError({
                    message: tpl(messages.ownerOnly)
                });
            }
        },
        async query(frame) {
            return securityActions.resetStaffPasswords(frame.options);
        }
    }
};

module.exports = controller;
