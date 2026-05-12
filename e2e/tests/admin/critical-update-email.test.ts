import {expect, test} from '@/helpers/playwright';

/**
 * Verifies BER-3627: when the update-check service reports an alert-type
 * notification, Ghost sends a fully templated HTML email to site admins
 * (rather than the previous plaintext-stripped message).
 *
 * The flow under test is end-to-end:
 *
 *   1. Ghost's admin controller fires off `updateCheck()` on every request
 *      to `/ghost/`.
 *   2. `updateCheck__url` is overridden to point at the in-process fake
 *      update-check server, and `updateCheck__forceUpdate=true` bypasses
 *      Ghost's `next_update_check` gating.
 *   3. The fake server replies with an `alert`-type message, which causes
 *      `update-check-service.sendCriticalAlertEmail` to render the HTML
 *      template and dispatch it via the transactional mailer.
 *   4. Mailpit (the transactional mail catcher) receives the rendered email.
 */
test.describe('Ghost Admin - Critical update email', () => {
    test.use({updateCheckEnabled: true});

    const expectedSubject = 'A critical security update is available for your Ghost site';

    test.fixme('alert notification - sends a templated HTML email to admins', async ({ghostAccountOwner, updateCheckServer, emailClient}) => {
        // The full pipeline (Ghost container → http call → email → Mailpit)
        // is brittle across the Docker boundary because the admin-controller
        // fires updateCheck() fire-and-forget. The wiring is instead covered
        // by an in-process integration test at
        // ghost/core/test/integration/services/update-check-critical-email.test.js
        // which constructs UpdateCheckService against a local http server,
        // the real GhostMailer, real i18n, and the real template renderer.
        // Keeping this spec + the FakeUpdateCheckServer fixture in tree as
        // scaffolding for a future full-pipeline e2e if/when it becomes
        // worth the cost.
        const fakeUpdateCheck = updateCheckServer!;

        await fakeUpdateCheck.waitForCheckins(1, 60_000);

        const messages = await emailClient.search(
            {subject: expectedSubject, to: ghostAccountOwner.email},
            {timeoutMs: 30_000}
        );

        expect(messages.length).toBeGreaterThan(0);

        const latest = await emailClient.getMessageDetailed(messages[0]);

        expect(latest.Subject).toBe(expectedSubject);
        expect(latest.HTML).toContain('<!doctype html>');
        expect(latest.HTML).toMatch(/critical update is available/i);
        expect(latest.HTML).toContain('View upgrade guide');
        expect(latest.HTML).toContain('https://ghost.org/docs/update/');
        expect(latest.Subject).not.toMatch(/CVE|exploit|vulnerab/i);
        expect(latest.HTML).not.toMatch(/CVE|exploit|vulnerab/i);
    });
});
