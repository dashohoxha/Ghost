import NiceModal from '@ebay/nice-modal-react';
import React from 'react';
import TopLevelGroup from '../../top-level-group';
import UrlConfirmationModal from './danger-zone/url-confirmation-modal';
import {Button, ConfirmationModal, SettingGroupHeader, showToast, withErrorBoundary} from '@tryghost/admin-x-design-system';
import {useDeleteAllContent} from '@tryghost/admin-x-framework/api/db';
import {useGlobalData} from '../../providers/global-data-provider';
import {useHandleError} from '@tryghost/admin-x-framework/hooks';
import {useQueryClient} from '@tryghost/admin-x-framework';
import {useRotateApiKeys} from '@tryghost/admin-x-framework/api/security';

const DangerZone: React.FC<{ keywords: string[] }> = ({keywords}) => {
    const {mutateAsync: deleteAllContent} = useDeleteAllContent();
    const {mutateAsync: rotateApiKeys} = useRotateApiKeys();
    const client = useQueryClient();
    const handleError = useHandleError();
    const {siteData, config} = useGlobalData();

    // TODO(BER-3633): replace this ad-hoc check with the proper
    // `hostSettings.securityActions.enabled` config knob once that issue
    // lands. For now we look for the (currently undefined) flag and default
    // to "visible" when it's absent.
    const securityActionsHostSetting = (config?.hostSettings as Record<string, unknown> | undefined)?.securityActions as
        | {enabled?: boolean}
        | undefined;
    const securityActionsEnabled = securityActionsHostSetting?.enabled !== false;

    const siteUrl = siteData?.url ?? '';

    const handleDeleteAllContent = () => {
        NiceModal.show(ConfirmationModal, {
            title: 'Would you really like to delete all content from your blog?',
            prompt: 'This is permanent! No backups, no restores, no magic undo button. We warned you, k?',
            okColor: 'red',
            okLabel: 'Delete',
            onOk: async (modal) => {
                try {
                    await deleteAllContent(null);
                    showToast({
                        title: 'All content deleted from database.',
                        type: 'success'
                    });
                    modal?.remove();
                    await client.refetchQueries();
                } catch (e) {
                    handleError(e);
                }
            }
        });
    };

    const handleRotateApiKeys = () => {
        NiceModal.show(UrlConfirmationModal, {
            title: 'Rotate every API key on your site?',
            prompt: (
                <>
                    This regenerates the secret for every Admin and Content API key on your site. Any integration, theme, or
                    script using an existing key will stop working until it&apos;s updated with the new key. This action
                    cannot be undone.
                </>
            ),
            confirmationValue: siteUrl,
            okLabel: 'Rotate API keys',
            okRunningLabel: 'Rotating...',
            okColor: 'red',
            onOk: async (modal) => {
                try {
                    const response = await rotateApiKeys(null);
                    const count = response?.security_action?.[0]?.count ?? 0;
                    showToast({
                        title: count === 1
                            ? '1 API key rotated. Update any integration that uses it.'
                            : `${count} API keys rotated. Update any integrations that use them.`,
                        type: 'success'
                    });
                    modal?.remove();
                    await client.invalidateQueries(['IntegrationsResponseType']);
                } catch (e) {
                    handleError(e);
                }
            }
        });
    };

    return (
        <TopLevelGroup
            customHeader={
                <SettingGroupHeader description='Permanently delete all posts and tags from the database, a hard reset' title='Danger zone' />
            }
            keywords={keywords}
            navid='dangerzone'
            testId='dangerzone'
        >
            <div className='flex flex-col items-start gap-3'>
                <Button color='red' label='Delete all content' onClick={handleDeleteAllContent} />
                {securityActionsEnabled && (
                    <Button
                        color='red'
                        label='Rotate API keys'
                        testId='rotate-api-keys-button'
                        onClick={handleRotateApiKeys}
                    />
                )}
            </div>
        </TopLevelGroup>
    );
};

export default withErrorBoundary(DangerZone, 'Danger zone');
