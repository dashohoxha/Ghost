import {BasePage} from '@/helpers/pages';
import {Locator, Page} from '@playwright/test';

export class DangerZoneSection extends BasePage {
    readonly section: Locator;
    readonly heading: Locator;

    readonly rotateApiKeysButton: Locator;
    readonly deleteAllContentButton: Locator;

    readonly urlConfirmationModal: Locator;
    readonly urlConfirmationInput: Locator;
    readonly urlConfirmationOkButton: Locator;

    constructor(page: Page) {
        super(page, '/ghost/#/settings/advanced');

        this.section = page.getByTestId('dangerzone');
        this.heading = page.getByRole('heading', {level: 5, name: 'Danger zone'});

        this.rotateApiKeysButton = page.getByTestId('rotate-api-keys-button');
        this.deleteAllContentButton = page.getByRole('button', {name: 'Delete all content'});

        this.urlConfirmationModal = page.getByTestId('url-confirmation-modal');
        this.urlConfirmationInput = page.getByTestId('url-confirmation-input');
        this.urlConfirmationOkButton = this.urlConfirmationModal.getByRole('button').last();
    }

    async openRotateApiKeysModal() {
        await this.rotateApiKeysButton.click();
        await this.urlConfirmationModal.waitFor({state: 'visible'});
    }

    async typeConfirmation(value: string) {
        await this.urlConfirmationInput.fill(value);
    }
}
