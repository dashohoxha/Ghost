import NiceModal, {useModal} from '@ebay/nice-modal-react';
import React, {useState} from 'react';
import {Modal, TextField} from '@tryghost/admin-x-design-system';
import type {ButtonColor} from '@tryghost/admin-x-design-system';

export interface UrlConfirmationModalProps {
    title: string;
    /** Plain-text or React prompt shown above the input. */
    prompt: React.ReactNode;
    /**
     * The exact value the user must type to enable the OK button. Compared
     * case-insensitively against the input value after trimming whitespace.
     */
    confirmationValue: string;
    /** Label shown above the typing field. */
    confirmationLabel?: string;
    okLabel: string;
    okRunningLabel?: string;
    okColor?: ButtonColor;
    cancelLabel?: string;
    onOk: (modal?: {remove: () => void}) => void | Promise<void>;
    onCancel?: () => void;
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\/+$/, '');

/**
 * Confirmation modal that requires the user to type a specific string
 * (typically the site URL) before the destructive action is enabled.
 *
 * Use via `NiceModal.show(UrlConfirmationModal, {...})`.
 *
 * @internal Co-located with the Danger Zone for now; extract into the
 * shared design system once a second consumer outside Danger Zone needs it.
 */
export const UrlConfirmationModalContent: React.FC<UrlConfirmationModalProps> = ({
    title,
    prompt,
    confirmationValue,
    confirmationLabel = 'Type your site URL to confirm',
    okLabel,
    okRunningLabel = 'Working...',
    okColor = 'red',
    cancelLabel = 'Cancel',
    onOk,
    onCancel
}) => {
    const modal = useModal();
    const [typedValue, setTypedValue] = useState('');
    const [taskState, setTaskState] = useState<'running' | ''>('');

    const matches = normalize(typedValue) !== '' && normalize(typedValue) === normalize(confirmationValue);
    const okDisabled = !matches || taskState === 'running';

    return (
        <Modal
            backDropClick={false}
            buttonsDisabled={taskState === 'running'}
            cancelLabel={cancelLabel}
            okColor={okColor}
            okDisabled={okDisabled}
            okLabel={taskState === 'running' ? okRunningLabel : okLabel}
            testId='url-confirmation-modal'
            title={title}
            width={540}
            onCancel={onCancel}
            onOk={async () => {
                if (okDisabled) {
                    return;
                }
                setTaskState('running');
                try {
                    await onOk?.(modal);
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error('Unhandled Promise Rejection in URL confirmation modal.', e);
                }
                setTaskState('');
            }}
        >
            <div className='py-4'>
                <div className='mb-4 text-sm'>
                    {prompt}
                </div>
                <TextField
                    data-testid='url-confirmation-input'
                    hint={`To confirm, type "${confirmationValue}" below.`}
                    placeholder={confirmationValue}
                    title={confirmationLabel}
                    value={typedValue}
                    autoFocus
                    onChange={e => setTypedValue(e.target.value)}
                />
            </div>
        </Modal>
    );
};

const UrlConfirmationModal = NiceModal.create(UrlConfirmationModalContent);

export default UrlConfirmationModal;
