const assert = require('node:assert/strict');
const sinon = require('sinon');

const SecurityActionsService = require('../../../../../core/server/services/security-actions/security-actions-service');

function makeUser({email, roles}) {
    return {
        id: `user-${email}`,
        get: sinon.stub().callsFake((key) => {
            if (key === 'email') {
                return email;
            }
            return undefined;
        }),
        save: sinon.stub().resolves(),
        related: sinon.stub().withArgs('roles').returns(
            roles.map(name => ({get: sinon.stub().withArgs('name').returns(name)}))
        )
    };
}

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

            const svc = new SecurityActionsService({
                models,
                auth: {},
                deleteAllSessions: sinon.stub(),
                apiSettings: {},
                apiMail: {}
            });

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

            const svc = new SecurityActionsService({
                models, auth: {}, deleteAllSessions: sinon.stub(), apiSettings: {}, apiMail: {}
            });

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

            const svc = new SecurityActionsService({
                models, auth: {}, deleteAllSessions: sinon.stub(), apiSettings: {}, apiMail: {}
            });

            await svc.rotateApiKeys({context: {internal: true}});

            sinon.assert.notCalled(models.Action.add);
        });
    });

    describe('resetStaffPasswords', function () {
        it('locks every staff user, sends a reset email, and invalidates all sessions', async function () {
            const owner = makeUser({email: 'owner@example.com', roles: ['Owner']});
            const admin = makeUser({email: 'admin@example.com', roles: ['Administrator']});
            const editor = makeUser({email: 'editor@example.com', roles: ['Editor']});
            const author = makeUser({email: 'author@example.com', roles: ['Author']});
            const contributor = makeUser({email: 'contributor@example.com', roles: ['Contributor']});

            const models = {
                Base: {transaction: cb => cb('TXN')},
                User: {
                    findAll: sinon.stub().resolves({
                        models: [owner, admin, editor, author, contributor]
                    })
                },
                Action: {add: sinon.stub().resolves()}
            };
            const auth = {
                passwordreset: {
                    generateToken: sinon.stub().resolves('token-xyz'),
                    sendResetNotification: sinon.stub().resolves()
                }
            };
            const deleteAllSessions = sinon.stub().resolves();

            const svc = new SecurityActionsService({
                models, auth, deleteAllSessions, apiSettings: 'SETTINGS', apiMail: 'MAIL'
            });

            const result = await svc.resetStaffPasswords({context: {user: 'owner-1'}});

            // Contributor must be excluded
            assert.equal(result.count, 4);

            sinon.assert.calledOnce(owner.save);
            sinon.assert.calledWith(owner.save, sinon.match({status: 'locked'}));
            sinon.assert.calledOnce(admin.save);
            sinon.assert.calledOnce(editor.save);
            sinon.assert.calledOnce(author.save);
            sinon.assert.notCalled(contributor.save);

            assert.equal(auth.passwordreset.generateToken.callCount, 4);
            assert.equal(auth.passwordreset.sendResetNotification.callCount, 4);
            sinon.assert.calledWith(auth.passwordreset.generateToken.firstCall, 'owner@example.com', 'SETTINGS', 'TXN');

            sinon.assert.calledOnce(deleteAllSessions);
            sinon.assert.calledOnce(models.Action.add);
            const auditEntry = models.Action.add.firstCall.args[0];
            assert.equal(auditEntry.event, 'reset_staff_passwords');
            assert.equal(auditEntry.resource_type, 'security_action');
            assert.equal(auditEntry.actor_id, 'owner-1');
            assert.equal(auditEntry.context.count, 4);
        });

        it('continues when a single reset email fails', async function () {
            const admin = makeUser({email: 'admin@example.com', roles: ['Administrator']});
            const editor = makeUser({email: 'editor@example.com', roles: ['Editor']});

            const models = {
                Base: {transaction: cb => cb('TXN')},
                User: {findAll: sinon.stub().resolves({models: [admin, editor]})},
                Action: {add: sinon.stub().resolves()}
            };
            const auth = {
                passwordreset: {
                    generateToken: sinon.stub()
                        .onFirstCall().rejects(new Error('mail boom'))
                        .onSecondCall().resolves('tok'),
                    sendResetNotification: sinon.stub().resolves()
                }
            };
            const deleteAllSessions = sinon.stub().resolves();

            const svc = new SecurityActionsService({
                models, auth, deleteAllSessions, apiSettings: {}, apiMail: {}
            });

            const result = await svc.resetStaffPasswords({context: {user: 'owner-1'}});

            // Both users are still counted (locked + attempted)
            assert.equal(result.count, 2);
            sinon.assert.calledOnce(deleteAllSessions);
            // The second email did go out
            assert.equal(auth.passwordreset.sendResetNotification.callCount, 1);
        });

        it('still tears down sessions even if there are no staff users', async function () {
            const models = {
                Base: {transaction: cb => cb('TXN')},
                User: {findAll: sinon.stub().resolves({models: []})},
                Action: {add: sinon.stub().resolves()}
            };
            const deleteAllSessions = sinon.stub().resolves();

            const svc = new SecurityActionsService({
                models,
                auth: {passwordreset: {generateToken: sinon.stub(), sendResetNotification: sinon.stub()}},
                deleteAllSessions,
                apiSettings: {},
                apiMail: {}
            });

            const result = await svc.resetStaffPasswords({context: {user: 'owner-1'}});

            assert.equal(result.count, 0);
            sinon.assert.calledOnce(deleteAllSessions);
        });
    });
});
