import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { UserRole } from '@/contexts/AuthContext';
import {
    NotificationItem,
    fetchNotificationsByRole,
    getUnreadCount,
    markAllNotificationsAsRead as markAllAsReadInService,
    markNotificationAsRead as markAsReadInService,
} from '@/lib/notifications/service';

interface UseNotificationsResult {
    notifications: NotificationItem[];
    unreadCount: number;
    isLoading: boolean;
    markAsRead: (id: number) => void;
    markAllAsRead: () => void;
    refresh: () => Promise<void>;
}

const POLL_INTERVAL = 30000; // 30 seconds - configurable

export function useNotifications(role: UserRole): UseNotificationsResult {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const loadNotifications = useCallback(async () => {
        try {
            const data = await fetchNotificationsByRole(role);
            setNotifications(data);
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setIsLoading(false);
        }
    }, [role]);

    // Initial load
    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    // Auto-polling for new notifications
    useEffect(() => {
        // Set up polling interval
        pollIntervalRef.current = setInterval(() => {
            loadNotifications();
        }, POLL_INTERVAL);

        // Clean up on unmount
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [loadNotifications]);

    const unreadCount = useMemo(() => getUnreadCount(notifications), [notifications]);

    const markAsRead = useCallback(async (id: number) => {
        setNotifications((current) => 
            current.map((notification) =>
                notification.id === id ? { ...notification, is_read: true } : notification,
            )
        );
        // Async update to backend (fire and forget)
        try {
            await markAsReadInService(id, notifications);
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    }, [notifications]);

    const markAllAsRead = useCallback(async () => {
        setNotifications((current) =>
            current.map((notification) => ({ ...notification, is_read: true }))
        );
        // Async update to backend (fire and forget)
        try {
            await markAllAsReadInService(notifications);
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
    }, [notifications]);

    return {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        refresh: loadNotifications,
    };
}
