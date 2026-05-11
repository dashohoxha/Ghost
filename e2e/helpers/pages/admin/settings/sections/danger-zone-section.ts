import {BasePage} from '@/helpers/pages';
import {Locator, Page} from '@playwright/test';

export class DangerZoneSection extends BasePage {
    readonly section: Locator;
    readonly heading: Locator;

    readonly rotateApiKeysButton: Locator;
    readonly resetStaffPasswordsButton: Locator;
    readonly deleteAllContentButton: Locator;

    readonly urlConfirmationModal: Locator;
    readonly urlConfirmationInput: Locator;
    readonly urlConfirmationOkButton: Locator;

    constructor(page: Page) {
        super(page, '/ghost/#/settings/advanced');

        this.section = page.getByTestId('dangerzone');
        this.heading = page.getByRole('heading', {level: 5, name: 'Danger zone'});

        this.rotateApiKeysButton = page.getByTestId('rotate-api-keys-button');
        this.resetStaffPasswordsButton = page.getByTestId('reset-staff-passwords-button');
        this.deleteAllContentButton = page.getByRole('button', {name: 'Delete all content'});

        this.urlConfirmationModal = page.getByTestId('url-confirmation-modal');
        this.urlConfirmationInput = page.getByTestId('url-confirmation-input');
        // Matches the OK button of either danger-zone action by accessible
        // name rather than DOM order. Add new okLabel values here when more
        // destructive actions are added behind this same modal.
        this.urlConfirmationOkButton = this.urlConfirmationModal.getByRole('button', {
            name: /^(Rotate API keys|Reset all staff passwords)$/
        });
    }

    async openRotateApiKeysModal() {
        await this.rotateApiKeysButton.click();
        await this.urlConfirmationModal.waitFor({state: 'visible'});
    }

    async openResetStaffPasswordsModal() {
        await this.resetStaffPasswordsButton.click();
        await this.urlConfirmationModal.waitFor({state: 'visible'});
    }

    async typeConfirmation(value: string) {
        await this.urlConfirmationInput.fill(value);
    }
}
