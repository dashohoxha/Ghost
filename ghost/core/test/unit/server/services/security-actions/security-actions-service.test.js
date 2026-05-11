const assert = require('node:assert/strict');
const sinon = require('sinon');

const SecurityActionsService = require('../../../../../core/server/services/security-actions/security-actions-service');

describe('SecurityActionsService', function () {
    afterEach(function () {
        sinon.restore();
    });

    describe('rotateApiKeys', function () {
        it('refreshes the secret on every API key inside a single transaction', async function () {
            const apiKeyA = {id: 'key-a', toJSON: sinon.stub().returns({id: 'key-a', type: 'admin'})};
            const apiKeyB = {id: 'key-b', toJSON: sinon.stub().returns({id: 'key-b', type: 'content'})};
            const apiKeyCollection = {models: [apiKeyA, apiKeyB], length: 2};

            const models = {
                Base: {
                    transaction: cb => cb('TXN')
                },
                ApiKey: {
                    findAll: sinon.stub().resolves(apiKeyCollection),
                    refreshSecret: sinon.stub().resolves()
                },
                Action: {
                    add: sinon.stub().resolves()
                }
            };

            const svc = new SecurityActionsService({models});

            const result = await svc.rotateApiKeys({context: {user: 'owner-1'}});

            assert.equal(result.count, 2);
            sinon.assert.calledTwice(models.ApiKey.refreshSecret);
            sinon.assert.calledWith(models.ApiKey.refreshSecret.firstCall,
                {id: 'key-a', type: 'admin'},
                sinon.match({id: 'key-a', transacting: 'TXN'})
            );
            sinon.assert.calledOnce(models.Action.add);
            const auditEntry = models.Action.add.firstCall.args[0];
            assert.equal(auditEntry.event, 'rotated_api_keys');
            assert.equal(auditEntry.resource_type, 'security_action');
            assert.equal(auditEntry.actor_id, 'owner-1');
            assert.equal(auditEntry.actor_type, 'user');
            assert.equal(auditEntry.context.count, 2);
        });

        it('returns count=0 when there are no API keys', async function () {
            const models = {
                Base: {transaction: cb => cb('TXN')},
                ApiKey: {
                    findAll: sinon.stub().resolves({models: [], length: 0}),
                    refreshSecret: sinon.stub().resolves()
                },
                Action: {add: sinon.stub().resolves()}
            };

            const svc = new SecurityActionsService({models});

            const result = await svc.rotateApiKeys({context: {user: 'owner-1'}});

            assert.equal(result.count, 0);
            sinon.assert.notCalled(models.ApiKey.refreshSecret);
        });

        it('does not write an audit entry when there is no actor (internal context)', async function () {
            const models = {
                Base: {transaction: cb => cb('TXN')},
                ApiKey: {
                    findAll: sinon.stub().resolves({models: [], length: 0}),
                    refreshSecret: sinon.stub().resolves()
                },
                Action: {add: sinon.stub().resolves()}
            };

            const svc = new SecurityActionsService({models});

            await svc.rotateApiKeys({context: {internal: true}});

            sinon.assert.notCalled(models.Action.add);
        });
    });
});
