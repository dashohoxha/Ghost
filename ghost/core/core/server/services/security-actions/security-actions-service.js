// @ts-check
const errors = require('@tryghost/errors');
const logging = require('@tryghost/logging');

/**
 * Service for high-impact "danger zone" security actions exposed to site
 * owners from Settings → Advanced → Danger Zone.
 *
 * Each action records a top-level entry in the Actions table (the audit log)
 * with `resource_type = 'security_action'` and a context describing what was
 * done and how many records were affected.
 */
class SecurityActionsService {
    /**
     * @param {Object} deps
     * @param {Object} deps.models - Bookshelf models (ApiKey, Action, Base)
     */
    constructor({models}) {
        this.models = models;
    }

    /**
     * Rotate the secret for every API key on the site in a single transaction.
     * Each individual rotation produces a per-key `refreshed` action via the
     * existing ApiKey model hooks; we additionally insert a top-level
     * `security_action` row recording the bulk operation, the actor, and the
     * total count.
     *
     * @param {Object} frameOptions - the API frame options (context, transacting, ...)
     * @returns {Promise<{count: number}>}
     */
    async rotateApiKeys(frameOptions) {
        const result = await this.models.Base.transaction(async (t) => {
            const opts = Object.assign({}, frameOptions, {transacting: t});
            const apiKeys = await this.models.ApiKey.findAll(opts);

            for (const apiKey of apiKeys.models) {
                await this.models.ApiKey.refreshSecret(apiKey.toJSON(), Object.assign({}, opts, {id: apiKey.id}));
            }

            const count = apiKeys.length;
            await this._recordAuditEntry({
                event: 'rotated_api_keys',
                count,
                options: opts
            });

            return {count};
        });

        return result;
    }

    /**
     * Insert a top-level row into the `actions` table for an admin-initiated
     * security action. Uses `resource_type = 'security_action'` so these
     * entries can be filtered out of the regular per-resource audit feeds.
     *
     * @private
     */
    async _recordAuditEntry({event, count, options}) {
        const context = options && options.context;
        if (!context || !context.user) {
            // Internal/system invocation - skip the audit entry rather than
            // attributing it to an unknown actor.
            return;
        }

        try {
            await this.models.Action.add({
                event,
                resource_type: 'security_action',
                resource_id: null,
                actor_type: 'user',
                actor_id: context.user,
                context: {
                    count,
                    action_name: event
                }
            }, {autoRefresh: false, transacting: options.transacting});
        } catch (err) {
            // Audit logging is best-effort; never let it break the action itself.
            logging.error(new errors.InternalServerError({
                err,
                message: `Failed to record security_action audit entry for ${event}`
            }));
        }
    }
}

module.exports = SecurityActionsService;
