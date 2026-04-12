import { UserRole } from '@/contexts/AuthContext';
import { NOTIFICATION_TYPE_CONFIG, NotificationType } from '@/lib/notifications/config';
import apiClient from '@/lib/api-client';

export interface NotificationItem {
    id: number;
    user_id: number;
    type: string;
    title: string;
    message: string;
    link?: string;
    course_id?: number;
    assignment_id?: number;
    submission_id?: number;
    is_read: boolean;
    read_at?: string;
    created_at: string;
}

export function supportsRole(type: string, role: UserRole): boolean {
    const config = NOTIFICATION_TYPE_CONFIG[type as NotificationType];
    if (!config) return true; // show unknown types to all roles
    return config.roles.includes(role);
}

export function filterNotificationsByRole(
    notifications: NotificationItem[],
    role: UserRole,
): NotificationItem[] {
    return notifications.filter((notification) => supportsRole(notification.type, role));
}

export function sortByLatest(notifications: NotificationItem[]): NotificationItem[] {
    return [...notifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

export async function fetchNotificationsByRole(role: UserRole): Promise<NotificationItem[]> {
    try {
        const notifications = (await apiClient.getNotifications(0, 50)) as NotificationItem[];
        const filtered = filterNotificationsByRole(notifications, role);
        return sortByLatest(filtered);
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        return [];
    }
}

export function getUnreadCount(notifications: NotificationItem[]): number {
    return notifications.filter((notification) => !notification.is_read).length;
}

export async function markNotificationAsRead(
    notificationId: number,
    notifications: NotificationItem[],
): Promise<NotificationItem[]> {
    try {
        await apiClient.markNotificationAsRead(notificationId, true);
        return notifications.map((notification) =>
            notification.id === notificationId ? { ...notification, is_read: true } : notification,
        );
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
        return notifications;
    }
}

export async function markAllNotificationsAsRead(
    notifications: NotificationItem[],
): Promise<NotificationItem[]> {
    try {
        await apiClient.markAllNotificationsAsRead();
        return notifications.map((notification) => ({ ...notification, is_read: true }));
    } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        return notifications;
    }
}
