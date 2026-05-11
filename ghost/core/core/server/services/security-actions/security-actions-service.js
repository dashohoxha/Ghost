// @ts-check
const errors = require('@tryghost/errors');
const logging = require('@tryghost/logging');

const STAFF_ROLES_FOR_PASSWORD_RESET = ['Owner', 'Administrator', 'Editor', 'Author'];

/**
 * Service for high-impact "danger zone" security actions exposed to site owners
 * from Settings → Advanced → Danger Zone (issues BER-3628 / BER-3629).
 *
 * Each action records a top-level entry in the Actions table (the audit log)
 * with `resource_type = 'security_action'` and a context describing what was
 * done and how many records were affected.
 */
class SecurityActionsService {
    /**
     * @param {Object} deps
     * @param {Object} deps.models           - Bookshelf models (User, ApiKey, Action, Base, Role)
     * @param {Object} deps.auth             - Auth service (passwordreset)
     * @param {Function} deps.deleteAllSessions - Function that destroys every session
     * @param {Object} deps.apiSettings      - settings api (for db_hash)
     * @param {Object} deps.apiMail          - mail api
     */
    constructor({models, auth, deleteAllSessions, apiSettings, apiMail}) {
        this.models = models;
        this.auth = auth;
        this.deleteAllSessions = deleteAllSessions;
        this.apiSettings = apiSettings;
        this.apiMail = apiMail;
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
     * Reset passwords for every active staff user with one of the
     * STAFF_ROLES_FOR_PASSWORD_RESET roles. Locks each user so they cannot
     * sign in until they complete the reset, generates a reset token, and
     * sends the existing reset-password email.
     *
     * After the transaction commits, all sessions in the store are destroyed
     * (including the triggering owner's own session) so anyone currently
     * signed in is forced through the reset flow.
     *
     * @param {Object} frameOptions
     * @returns {Promise<{count: number}>}
     */
    async resetStaffPasswords(frameOptions) {
        const result = await this.models.Base.transaction(async (t) => {
            const opts = Object.assign({}, frameOptions, {transacting: t});

            const users = await this.models.User.findAll(Object.assign({}, opts, {
                withRelated: ['roles']
            }));

            const staffUsers = users.models.filter((user) => {
                const roles = user.related('roles');
                if (!roles || roles.length === 0) {
                    return false;
                }
                return roles.some(role => STAFF_ROLES_FOR_PASSWORD_RESET.includes(role.get('name')));
            });

            for (const user of staffUsers) {
                await user.save({
                    status: 'locked'
                }, opts);
            }

            for (const user of staffUsers) {
                try {
                    const token = await this.auth.passwordreset.generateToken(user.get('email'), this.apiSettings, t);
                    await this.auth.passwordreset.sendResetNotification(token, this.apiMail);
                } catch (err) {
                    // Don't fail the whole operation if a single email fails; the user is
                    // already locked and an admin can reissue from the login screen.
                    logging.error(new errors.InternalServerError({
                        err,
                        message: `Failed to send password reset to ${user.get('email')}`
                    }));
                }
            }

            const count = staffUsers.length;
            await this._recordAuditEntry({
                event: 'reset_staff_passwords',
                count,
                options: opts
            });

            return {count};
        });

        // Invalidate every active session - including the triggering owner's.
        // Anyone currently authenticated must sign back in (and, since their
        // user row is locked, must complete the reset flow first).
        await this.deleteAllSessions();

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

SecurityActionsService.STAFF_ROLES_FOR_PASSWORD_RESET = STAFF_ROLES_FOR_PASSWORD_RESET;

module.exports = SecurityActionsService;
