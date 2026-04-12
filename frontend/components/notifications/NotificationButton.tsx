'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { UserRole } from '@/contexts/AuthContext';
import { NotificationList } from '@/components/notifications/NotificationList';
import { useNotifications } from '@/lib/notifications/useNotifications';

interface NotificationButtonProps {
    role: UserRole;
}

function UnreadBadge({ count }: { count: number }) {
    if (count <= 0) return null;

    return (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[11px] font-semibold px-1 flex items-center justify-center">
            {count > 99 ? '99+' : count}
        </span>
    );
}

function NotificationMenuHeader({
    unreadCount,
    onMarkAllAsRead,
}: {
    unreadCount: number;
    onMarkAllAsRead: () => void;
}) {
    return (
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            <button
                onClick={onMarkAllAsRead}
                disabled={unreadCount === 0}
                className="text-xs font-medium text-[#862733] disabled:text-gray-300"
            >
                Mark all as read
            </button>
        </div>
    );
}

export function NotificationButton({ role }: NotificationButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const markAllTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications(role);

    useEffect(() => {
        const closeOnOutsideClick = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, []);

    // Clean up timer on unmount
    useEffect(() => {
        return () => {
            if (markAllTimerRef.current) clearTimeout(markAllTimerRef.current);
        };
    }, []);

    // When the dropdown closes, cancel any pending mark-all timer
    useEffect(() => {
        if (!isOpen && markAllTimerRef.current) {
            clearTimeout(markAllTimerRef.current);
            markAllTimerRef.current = null;
        }
    }, [isOpen]);

    const handleToggle = () => {
        const opening = !isOpen;
        setIsOpen(opening);
        if (opening && unreadCount > 0) {
            // Mark all as read after a short delay so the user can see the unread dots briefly
            markAllTimerRef.current = setTimeout(() => {
                markAllAsRead();
                markAllTimerRef.current = null;
            }, 1500);
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={handleToggle}
                className="relative rounded-full p-1.5 sm:p-2 text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Notifications"
                aria-expanded={isOpen}
            >
                <Bell className="h-5 w-5" />
                <UnreadBadge count={unreadCount} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg z-50">
                    <NotificationMenuHeader
                        unreadCount={unreadCount}
                        onMarkAllAsRead={markAllAsRead}
                    />
                    <NotificationList
                        notifications={notifications}
                        isLoading={isLoading}
                        onItemClick={markAsRead}
                    />
                </div>
            )}
        </div>
    );
}