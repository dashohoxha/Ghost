const assert = require('node:assert/strict');
const {agentProvider, mockManager, fixtureManager, matchers} = require('../../utils/e2e-framework');
const {anyContentVersion, anyEtag} = matchers;

const models = require('../../../core/server/models');

describe('Security actions API', function () {
    let agent;

    describe('rotateApiKeys', function () {
        before(async function () {
            agent = await agentProvider.getAdminAPIAgent();
            await fixtureManager.init('users', 'integrations', 'api_keys');
        });

        beforeEach(async function () {
            mockManager.mockMail();
        });

        afterEach(function () {
            mockManager.restore();
        });

        it('is forbidden for unauthenticated callers', async function () {
            await agent
                .post('security/rotate_api_keys')
                .body({})
                .expectStatus(403);
        });

        it('is forbidden for Author-role users', async function () {
            await agent.loginAsAuthor();

            await agent
                .post('security/rotate_api_keys')
                .body({})
                .expectStatus(403);
        });

        it('rotates every API key when called by an Administrator', async function () {
            await agent.loginAsAdmin();

            const before = (await models.ApiKey.findAll({}))
                .toJSON()
                .reduce((acc, key) => {
                    acc[key.id] = key.secret;
                    return acc;
                }, {});

            const totalBefore = Object.keys(before).length;
            assert.ok(totalBefore > 0, 'fixture should contain at least one API key');

            const {body} = await agent
                .post('security/rotate_api_keys')
                .body({})
                .expectStatus(200)
                .matchHeaderSnapshot({
                    'content-version': anyContentVersion,
                    etag: anyEtag
                });

            assert.equal(body.security_action[0].action, 'rotate_api_keys');
            assert.equal(body.security_action[0].count, totalBefore);

            const after = (await models.ApiKey.findAll({})).toJSON();
            assert.equal(after.length, totalBefore);

            for (const key of after) {
                assert.notEqual(key.secret, before[key.id], `Secret for key ${key.id} should have changed`);
            }

            // Audit entry recorded
            const auditRows = await models.Action.findAll({
                filter: 'resource_type:security_action+event:rotated_api_keys'
            });
            assert.ok(auditRows.length >= 1, 'expected an audit entry for rotated_api_keys');
        });
    });
});
