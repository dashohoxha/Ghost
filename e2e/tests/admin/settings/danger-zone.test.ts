import {SettingsPage} from '@/admin-pages';
import {expect, test} from '@/helpers/playwright';

test.describe('Ghost Admin - Danger Zone security actions', () => {
    test('rotate API keys button - URL confirmation gates the action', async ({page}) => {
        const settingsPage = new SettingsPage(page);
        await settingsPage.dangerZoneSection.goto();

        await expect(settingsPage.dangerZoneSection.rotateApiKeysButton).toBeVisible();

        await settingsPage.dangerZoneSection.openRotateApiKeysModal();

        // OK button is disabled until the site URL is typed correctly
        await expect(settingsPage.dangerZoneSection.urlConfirmationOkButton).toBeDisabled();

        await settingsPage.dangerZoneSection.typeConfirmation('not-the-right-url');
        await expect(settingsPage.dangerZoneSection.urlConfirmationOkButton).toBeDisabled();
    });

    test('rotate API keys - happy path shows success toast with the count', async ({page, baseURL}) => {
        const settingsPage = new SettingsPage(page);
        await settingsPage.dangerZoneSection.goto();

        await settingsPage.dangerZoneSection.openRotateApiKeysModal();
        await settingsPage.dangerZoneSection.typeConfirmation(baseURL ?? '');

        await expect(settingsPage.dangerZoneSection.urlConfirmationOkButton).toBeEnabled();
        await settingsPage.dangerZoneSection.urlConfirmationOkButton.click();

        await expect(page.getByText(/API key.* rotated\./i)).toBeVisible();
    });
});
