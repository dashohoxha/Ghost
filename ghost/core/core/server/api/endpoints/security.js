const models = require('../../models');
const SecurityActionsService = require('../../services/security-actions/security-actions-service');

const securityActions = new SecurityActionsService({models});

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
    }
};

module.exports = controller;
