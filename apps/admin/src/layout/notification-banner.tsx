import {Banner} from '@tryghost/shade/components';
import {LucideIcon} from '@tryghost/shade/utils';
import {useBrowseNotifications, useDeleteNotification} from '@tryghost/admin-x-framework/api/notifications';
import type {Notification} from '@tryghost/admin-x-framework/api/notifications';

type BannerState = 'info' | 'warning';

// Match the legacy Ember behaviour: only render notifications that are
// `top` or `custom` here. Non-top release notifications are handled by the
// `upgradeStatus` flow and shouldn't be duplicated as a banner.
function isBannerNotification(notification: Notification): boolean {
    return Boolean(notification.top || notification.custom);
}

// The API has two overlapping state dimensions (status + type). The banner
// only has two visual states. This is the single mapping point — variant,
// role, and icon all flow from the value returned here.
function bannerStateFor(notification: Notification): BannerState {
    if (notification.status === 'alert'
        || notification.type === 'warn'
        || notification.type === 'error') {
        return 'warning';
    }
    return 'info';
}

const ROLES: Record<BannerState, 'alert' | 'status'> = {
    warning: 'alert',
    info: 'status'
};

const ICONS: Record<BannerState, typeof LucideIcon.Info> = {
    warning: LucideIcon.AlertTriangle,
    info: LucideIcon.Info
};

const ICON_COLOURS: Record<BannerState, string> = {
    warning: 'text-state-warning',
    info: 'text-state-info'
};

// Higher number = higher priority. Warning banners sort above info so the
// most-urgent state is closest to the top of the page.
const STATE_PRIORITY: Record<BannerState, number> = {
    warning: 1,
    info: 0
};

interface NotificationItemProps {
    notification: Notification;
    onDismiss: (id: string) => void;
}

function NotificationItem({notification, onDismiss}: NotificationItemProps) {
    const state = bannerStateFor(notification);
    const dismissible = notification.dismissible !== false;
    const Icon = ICONS[state];

    const handleDismiss = () => onDismiss(notification.id);

    const bannerProps = dismissible
        ? ({dismissible: true, onDismiss: handleDismiss} as const)
        : ({dismissible: false} as const);

    return (
        <Banner
            className="mx-3 mt-3"
            data-test-notification-id={notification.id}
            role={ROLES[state]}
            size="md"
            variant={state}
            {...bannerProps}
        >
            <div className="flex items-start gap-2 pr-8">
                <Icon className={`mt-0.5 size-4 shrink-0 ${ICON_COLOURS[state]}`} />
                <div
                    className="text-sm text-foreground [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2"
                    dangerouslySetInnerHTML={{__html: notification.message}}
                />
            </div>
        </Banner>
    );
}

function NotificationBanner() {
    const {data} = useBrowseNotifications({defaultErrorHandler: false});
    const {mutate: deleteNotification} = useDeleteNotification();

    const notifications = (data?.notifications ?? [])
        .filter(isBannerNotification)
        .slice()
        .sort((a, b) => STATE_PRIORITY[bannerStateFor(b)] - STATE_PRIORITY[bannerStateFor(a)]);

    if (notifications.length === 0) {
        return null;
    }

    return (
        <div
            aria-label="Notifications"
            className="flex flex-col"
            role="region"
        >
            {notifications.map(notification => (
                <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={id => deleteNotification(id)}
                />
            ))}
        </div>
    );
}

export default NotificationBanner;
