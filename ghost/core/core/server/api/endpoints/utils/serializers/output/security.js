const debug = require('@tryghost/debug')('api:endpoints:utils:serializers:output:security');

module.exports = {
    rotateApiKeys(response, apiConfig, frame) {
        debug('rotateApiKeys');

        frame.response = {
            security_action: [{
                action: 'rotate_api_keys',
                count: response?.count ?? 0
            }]
        };
    },

    resetStaffPasswords(response, apiConfig, frame) {
        debug('resetStaffPasswords');

        frame.response = {
            security_action: [{
                action: 'reset_staff_passwords',
                count: response?.count ?? 0
            }]
        };
    }
};
