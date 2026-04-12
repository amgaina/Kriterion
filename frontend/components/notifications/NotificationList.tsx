'use client';

import { formatDistanceToNow } from 'date-fns';
import { NotificationItem } from '@/lib/notifications/service';
import { NOTIFICATION_TYPE_CONFIG } from '@/lib/notifications/config';

interface NotificationListProps {
    notifications: NotificationItem[];
    isLoading: boolean;
    onItemClick: (id: number) => void;
}

function NotificationListSkeleton() {
    return (
        <div className="space-y-3 p-3">
            {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-lg bg-gray-100 h-14" />
            ))}
        </div>
    );
}

function EmptyNotificationState() {
    return (
        <div className="p-4 text-center text-sm text-gray-500">
            No notifications for your role.
        </div>
    );
}

interface NotificationRowProps {
    notification: NotificationItem;
    onClick: (id: number) => void;
}

function NotificationRow({ notification, onClick }: NotificationRowProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typeLabel = (NOTIFICATION_TYPE_CONFIG as any)[notification.type]?.label ?? notification.title ?? 'Notification';
    
    // Parse timestamp - backend sends UTC, append 'Z' if not present to ensure proper parsing
    const timestamp = notification.created_at.endsWith('Z') 
        ? notification.created_at 
        : `${notification.created_at}Z`;
    const timeLabel = formatDistanceToNow(new Date(timestamp), { addSuffix: true });

    return (
        <button
            onClick={() => onClick(notification.id)}
            className="w-full rounded-lg p-3 text-left transition-colors hover:bg-gray-50"
        >
            <div className="flex items-start gap-3">
                <span
                    className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${
                        notification.is_read ? 'bg-gray-300' : 'bg-[#862733]'
                    }`}
                    aria-hidden
                />
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-600">{typeLabel}</p>
                    <p className="text-sm text-gray-900 leading-5">{notification.message}</p>
                    <p className="mt-1 text-xs text-gray-500">{timeLabel}</p>
                </div>
            </div>
        </button>
    );
}

export function NotificationList({ notifications, isLoading, onItemClick }: NotificationListProps) {
    if (isLoading) {
        return <NotificationListSkeleton />;
    }

    if (!notifications.length) {
        return <EmptyNotificationState />;
    }

    return (
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
            {notifications.map((notification) => (
                <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onClick={onItemClick}
                />
            ))}
        </div>
    );
}